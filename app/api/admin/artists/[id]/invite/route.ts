/**
 * app/api/admin/artists/[id]/invite/route.ts
 *
 * POST /api/admin/artists/:id/invite
 *
 * Sends a branded invite email to the artist's registered email address so
 * they can set a password and access the Artist Portal.
 *
 * Security:
 *   - Only users with role = 'admin' may call this endpoint.
 *   - Returns 409 Conflict if the artist already has a linked user_id.
 *   - Returns 400 if the artist has no email address set.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requestUserInvite } from '@/lib/auth/requestUserInvite'
import { getUserRoleWithClient } from '@/lib/getUserRole'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { ApiError, buildApiError, withErrorHandler } from '@/lib/errors'
import { getEmailCredentials } from '@/lib/secrets/getExternalCredentials'

function extractArtistId(req: NextRequest): string {
  const segments = new URL(req.url).pathname.split('/')
  return segments[4]
}

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
  return { adminClient, currentUserId: user.id }
}

export const POST = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const { adminClient, currentUserId } = await requireAdmin()

  const artistId = extractArtistId(req)
  if (!artistId) throw new ApiError(400, 'Missing artist ID')

  const { data: artist, error: artistError } = await adminClient
    .from('artists')
    .select('id, name, email, user_id')
    .eq('id', artistId)
    .single()

  if (artistError || !artist) throw new ApiError(404, 'Artist not found')

  if (artist.user_id) {
    throw new ApiError(
      409,
      `Artist "${artist.name}" already has a linked user account. Remove the existing link before sending a new invite.`,
    )
  }

  let email: string | null = artist.email ?? null

  if (!email) {
    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      // body is optional
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

  const { resendApiKey, resendFromEmail } = await getEmailCredentials(adminClient)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://darktunes.com'

  const result = await requestUserInvite(
    adminClient,
    {
      email,
      role: 'artist',
      portal: true,
      artistId,
      grantedBy: currentUserId,
    },
    {
      resendApiKey,
      resendFromEmail: resendFromEmail ?? 'noreply@darktunes.com',
      siteUrl,
      fetch,
    },
  )

  if (result.alreadyRegistered) {
    throw new ApiError(409, `A user with email "${email}" already exists.`)
  }

  if (!result.sent) {
    throw buildApiError('EMAIL_SEND_FAILED', 500)
  }

  return NextResponse.json({ ok: true, email, channel: result.channel })
})