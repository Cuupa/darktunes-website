/**
 * app/api/admin/users/[id]/link-artist/route.ts
 *
 * PATCH /api/admin/users/:id/link-artist
 * Links (or unlinks) an Auth user to an artist row.
 *
 * Body:
 *   { artistId: string }          — link artist to user
 *   { artistId: null }            — unlink (clears artists.user_id)
 *
 * Security: only users with role = 'admin' may call this endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { linkArtistToUser, unlinkArtistFromUser } from '@/lib/api/users'

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const patchSchema = z.object({
  artistId: z.string().uuid().nullable(),
})

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Extract the user [id] segment (second-to-last segment). */
function extractUserId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/')
  // path: /api/admin/users/:id/link-artist
  return segments[segments.length - 2]
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const PATCH = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  // 1. Auth + role check
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new ApiError(401, 'Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') throw new ApiError(403, 'Forbidden')

  // 2. Parse body
  const body: unknown = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join('; ')
    throw new ApiError(400, message, 'VALIDATION_ERROR')
  }

  const userId = extractUserId(req)
  const { artistId } = parsed.data

  const adminClient = await createServiceRoleSupabaseClient()

  if (artistId === null) {
    // Unlink: find the artist currently linked to this user and clear it
    const { data: linkedArtist, error: lookupErr } = await adminClient
      .from('artists')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (lookupErr) throw new ApiError(500, lookupErr.message)

    if (linkedArtist) {
      await unlinkArtistFromUser(adminClient, linkedArtist.id)
    }
  } else {
    // Check target artist isn't already linked to a different user
    const { data: targetArtist, error: lookupErr } = await adminClient
      .from('artists')
      .select('id, user_id')
      .eq('id', artistId)
      .maybeSingle()

    if (lookupErr) throw new ApiError(500, lookupErr.message)
    if (!targetArtist) throw new ApiError(404, 'Artist not found')
    if (targetArtist.user_id && targetArtist.user_id !== userId) {
      throw new ApiError(409, 'This artist is already linked to another user')
    }

    // Check the user isn't already linked to a different artist
    const { data: existingArtist, error: existingErr } = await adminClient
      .from('artists')
      .select('id')
      .eq('user_id', userId)
      .neq('id', artistId)
      .maybeSingle()

    if (existingErr) throw new ApiError(500, existingErr.message)
    if (existingArtist) {
      throw new ApiError(409, 'This user is already linked to another artist')
    }

    await linkArtistToUser(adminClient, artistId, userId)
  }

  return NextResponse.json({ success: true })
})
