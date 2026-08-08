/**
 * GET /auth/invite?token=…
 *
 * Exchanges a durable invite token (app-controlled expiry) for a fresh
 * Supabase invite OTP and redirects into /auth/callback for session setup.
 *
 * Hardened: rate limit, token format check, atomic consume, no open redirects.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  consumeInvite,
  findValidInviteByRawToken,
  isValidInviteRawTokenFormat,
} from '@/lib/api/userInvites'
import {
  buildInviteVerifyUrl,
  buildPasswordRecoveryVerifyUrl,
  getArtistInviteRedirectUrl,
  getUserInviteRedirectUrl,
} from '@/lib/auth/resolveRedirectPath'
import { enforcePublicInviteExchangeRateLimit } from '@/lib/auth/inviteAdmin'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'

function inviteFailRedirect(origin: string, reason: string, portal?: boolean): NextResponse {
  if (portal) {
    const search = new URLSearchParams({ error: reason })
    return NextResponse.redirect(`${origin}/portal/accept-invite?${search}`)
  }
  const search = new URLSearchParams({ type: 'invite', error: reason })
  return NextResponse.redirect(`${origin}/login?${search}`)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url)
  const rawToken = searchParams.get('token')?.trim() ?? ''

  if (!rawToken || !isValidInviteRawTokenFormat(rawToken)) {
    return inviteFailRedirect(origin, 'missing_invite_token')
  }

  const allowed = await enforcePublicInviteExchangeRateLimit(request)
  if (!allowed) {
    return inviteFailRedirect(origin, 'rate_limited')
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? origin).replace(/\/$/, '')

  let adminClient
  try {
    adminClient = await createServiceRoleSupabaseClient()
  } catch {
    console.error('[auth/invite] service role client unavailable')
    return inviteFailRedirect(origin, 'auth_failed')
  }

  let invite
  try {
    invite = await findValidInviteByRawToken(adminClient, rawToken)
  } catch (err) {
    console.error('[auth/invite] lookup failed:', err)
    return inviteFailRedirect(origin, 'auth_failed')
  }

  if (!invite) {
    return inviteFailRedirect(origin, 'invite_expired')
  }

  // Consume before generating OTP so a stolen parallel request cannot re-use the durable token.
  let consumed = false
  try {
    consumed = await consumeInvite(adminClient, invite.id)
  } catch (err) {
    console.error('[auth/invite] consume failed:', err)
    return inviteFailRedirect(origin, 'auth_failed', invite.portal)
  }
  if (!consumed) {
    return inviteFailRedirect(origin, 'invite_expired', invite.portal)
  }

  const redirectTo = invite.portal
    ? getArtistInviteRedirectUrl(siteUrl)
    : getUserInviteRedirectUrl(siteUrl)

  const metadata: Record<string, string> = { role: invite.role }
  if (invite.artist_id) metadata.artist_id = invite.artist_id

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email: invite.email,
    options: { redirectTo, data: metadata },
  })

  let hashedToken = data?.properties?.hashed_token
  let useRecovery = false

  if (error || !hashedToken) {
    console.warn(
      '[auth/invite] invite generateLink failed, trying recovery:',
      error?.message ?? 'no hashed_token',
    )
    const recovery = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: invite.email,
      options: { redirectTo },
    })
    hashedToken = recovery.data?.properties?.hashed_token
    useRecovery = true
    if (recovery.error || !hashedToken) {
      console.error(
        '[auth/invite] recovery generateLink failed:',
        recovery.error?.message ?? 'no hashed_token',
      )
      return inviteFailRedirect(origin, 'auth_failed', invite.portal)
    }
  }

  if (useRecovery) {
    // Recovery lands on login set-password; portal users are guided after password set.
    const recoveryUrl = buildPasswordRecoveryVerifyUrl(siteUrl, hashedToken!)
    return NextResponse.redirect(recoveryUrl)
  }

  const verifyUrl = buildInviteVerifyUrl(siteUrl, hashedToken!, { portal: invite.portal })
  return NextResponse.redirect(verifyUrl)
}
