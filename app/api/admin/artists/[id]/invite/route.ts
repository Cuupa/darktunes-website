/**
 * app/api/admin/artists/[id]/invite/route.ts
 *
 * POST /api/admin/artists/:id/invite
 *
 * Sends a Supabase invite email to the artist's registered email address so
 * they can set a password and access the Artist Portal without the admin
 * having to copy/paste credentials manually.
 *
 * Security:
 *   - Only users with role = 'admin' may call this endpoint.
 *   - Returns 409 Conflict if the artist already has a linked user_id.
 *   - Returns 400 if the artist has no email address set.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { ApiError, buildApiError, withErrorHandler } from '@/lib/errors'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the [id] segment from the URL path. */
function extractArtistId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/')
  // path: /api/admin/artists/:id/invite  → segments[4] is the artist id
  return segments[4]
}

/** Shared auth + admin-role check. Returns { adminClient }. */
async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new ApiError(401, 'Unauthorized')

  const role = await getUserRoleWithClient(supabase, user.id)

  if (role !== 'admin') throw new ApiError(403, 'Forbidden')

  const adminClient = await createServiceRoleSupabaseClient()
  return { adminClient }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { adminClient } = await requireAdmin()

  const artistId = extractArtistId(req)
  if (!artistId) throw new ApiError(400, 'Missing artist ID')

  // Fetch the artist row to get email + current user_id
  const { data: artist, error: artistError } = await adminClient
    .from('artists')
    .select('id, name, email, user_id')
    .eq('id', artistId)
    .single()

  if (artistError || !artist) throw new ApiError(404, 'Artist not found')

  // Guard: already linked to an auth user
  if (artist.user_id) {
    throw new ApiError(
      409,
      `Artist "${artist.name}" already has a linked user account. Remove the existing link before sending a new invite.`,
    )
  }

  // Determine email: prefer artist.email, fall back to request body
  let email: string | null = artist.email ?? null

  if (!email) {
    // Allow caller to supply the email if not set on the artist row
    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      // no-op — body is optional
    }
    if (typeof body.email === 'string' && body.email.trim()) {
      email = body.email.trim()
    }
  }

  if (!email) {
    throw new ApiError(
      400,
      `Artist "${artist.name}" has no email address. Add an email before sending an invite.`,
    )
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://darktunes.com').replace(/\/$/, '')

  // Send the Supabase invite email
  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/portal/accept-invite`,
    data: { role: 'artist', artist_id: artistId },
  })

  if (inviteError) {
    throw buildApiError('EMAIL_SEND_FAILED', 500)
  }

  return NextResponse.json({ ok: true, email })
})
