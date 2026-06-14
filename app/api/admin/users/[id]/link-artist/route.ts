/**
 * app/api/admin/users/[id]/link-artist/route.ts
 *
 * PATCH /api/admin/users/:id/link-artist
 * Adds or removes an artist membership for an Auth user via artist_members.
 *
 * Body:
 *   { artistId: string }          — add membership (idempotent)
 *   { artistId: null }            — remove all memberships for this user
 *
 * Security: only users with role = 'admin' may call this endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { z } from 'zod'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { ApiError, buildApiError, withErrorHandler } from '@/lib/errors'

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const patchSchema = z.object({
  artistId: z.string().uuid().nullable(),
  memberRole: z.enum(['owner', 'member', 'guest']).optional().default('owner'),
  /** When true and artistId is provided, removes that specific membership instead of adding */
  remove: z.boolean().optional().default(false),
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

  const role = await getUserRoleWithClient(supabase, user.id)

  if (role !== 'admin') throw new ApiError(403, 'Forbidden')

  // 2. Parse body
  const body: unknown = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ')
    throw new ApiError(400, message, 'VALIDATION_ERROR')
  }

  const userId = extractUserId(req)
  const { artistId, memberRole, remove } = parsed.data

  const adminClient = await createServiceRoleSupabaseClient()

  if (artistId === null) {
    // Unlink: remove ALL artist memberships for this user
    const { error: deleteErr } = await adminClient
      .from('artist_members')
      .delete()
      .eq('user_id', userId)

    if (deleteErr) throw buildApiError('DB_ERROR', 500)
  } else if (remove === true) {
    // Remove a specific artist membership
    const { error: deleteErr } = await adminClient
      .from('artist_members')
      .delete()
      .eq('user_id', userId)
      .eq('artist_id', artistId)

    if (deleteErr) throw buildApiError('DB_ERROR', 500)
  } else {
    // Verify artist exists
    const { data: targetArtist, error: lookupErr } = await adminClient
      .from('artists')
      .select('id')
      .eq('id', artistId)
      .maybeSingle()

    if (lookupErr) throw buildApiError('DB_ERROR', 500)
    if (!targetArtist) throw buildApiError('NOT_FOUND', 404)

    // Add membership — ON CONFLICT updates the member_role if the row already exists
    const { error: upsertErr } = await adminClient
      .from('artist_members')
      .upsert({ user_id: userId, artist_id: artistId, member_role: memberRole }, { onConflict: 'user_id,artist_id' })

    if (upsertErr) throw buildApiError('DB_ERROR', 500)
  }

  return NextResponse.json({ success: true })
})
