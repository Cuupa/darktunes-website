/**
 * User invite: branded Resend email when configured,
 * Supabase inviteUserByEmail fallback otherwise.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getSiteSettings } from '@/lib/api/siteSettings'
import { syncInvitedUserAccess } from '@/lib/api/users'
import {
  buildInviteVerifyUrl,
  getArtistInviteRedirectUrl,
  getUserInviteRedirectUrl,
} from '@/lib/auth/resolveRedirectPath'
import { sendInviteEmail } from '@/lib/email/sendInviteEmail'
import type { Database } from '@/types/database'
import type { UserRole } from '@/types/users'

type DbClient = SupabaseClient<Database>

export type UserInviteChannel = 'resend' | 'supabase_fallback'

export interface RequestUserInviteOptions {
  email: string
  role: UserRole
  /** When true, invite link lands on /portal/accept-invite after verification. */
  portal?: boolean
  artistId?: string
  grantedBy: string
  metadata?: Record<string, string>
}

export interface RequestUserInviteDeps {
  resendApiKey: string | null
  resendFromEmail: string
  siteUrl: string
  fetch: typeof globalThis.fetch
}

export interface RequestUserInviteResult {
  sent: boolean
  channel?: UserInviteChannel
  userId?: string
  alreadyRegistered?: boolean
  error?: string
}

function isAlreadyRegistered(message: string): boolean {
  return message.toLowerCase().includes('already registered')
}

function buildInviteMetadata(
  options: RequestUserInviteOptions,
): Record<string, string> {
  const data: Record<string, string> = { role: options.role, ...options.metadata }
  if (options.artistId) {
    data.artist_id = options.artistId
  }
  return data
}

async function sendViaSupabaseFallback(
  client: DbClient,
  options: RequestUserInviteOptions,
  siteUrl: string,
): Promise<RequestUserInviteResult> {
  const redirectTo = options.portal
    ? `${siteUrl.replace(/\/$/, '')}/portal/accept-invite`
    : `${siteUrl.replace(/\/$/, '')}/login?type=invite`

  const { data, error } = await client.auth.admin.inviteUserByEmail(options.email, {
    redirectTo,
    data: buildInviteMetadata(options),
  })

  if (error) {
    if (isAlreadyRegistered(error.message)) {
      return { sent: false, alreadyRegistered: true, channel: 'supabase_fallback' }
    }
    console.warn('[requestUserInvite] Supabase fallback failed:', error.message)
    return { sent: false, channel: 'supabase_fallback', error: error.message }
  }

  const userId = data?.user?.id
  if (userId) {
    await syncInvitedUserAccess(
      client,
      userId,
      options.role,
      options.grantedBy,
      options.artistId,
    )
  }

  return { sent: true, channel: 'supabase_fallback', userId }
}

export async function requestUserInvite(
  adminClient: DbClient,
  options: RequestUserInviteOptions,
  deps: RequestUserInviteDeps,
): Promise<RequestUserInviteResult> {
  const normalizedEmail = options.email.trim()
  const siteUrl = deps.siteUrl.replace(/\/$/, '')
  const redirectTo = options.portal
    ? getArtistInviteRedirectUrl(siteUrl)
    : getUserInviteRedirectUrl(siteUrl)
  const metadata = buildInviteMetadata(options)

  if (!deps.resendApiKey) {
    console.warn(
      '[requestUserInvite] Resend not configured — falling back to Supabase invite email',
    )
    return sendViaSupabaseFallback(adminClient, options, siteUrl)
  }

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email: normalizedEmail,
    options: { redirectTo, data: metadata },
  })

  const hashedToken = data?.properties?.hashed_token
  const userId = data?.user?.id

  if (error) {
    if (isAlreadyRegistered(error.message)) {
      return { sent: false, alreadyRegistered: true, channel: 'resend' }
    }
    console.warn(
      '[requestUserInvite] generateLink failed — falling back to Supabase invite email:',
      error.message,
    )
    return sendViaSupabaseFallback(adminClient, options, siteUrl)
  }

  if (!hashedToken) {
    console.warn('[requestUserInvite] generateLink returned no hashed_token')
    return { sent: false, channel: 'resend', error: 'no hashed_token' }
  }

  if (userId) {
    await syncInvitedUserAccess(
      adminClient,
      userId,
      options.role,
      options.grantedBy,
      options.artistId,
    )
  }

  const settings = await getSiteSettings(adminClient)
  const inviteUrl = buildInviteVerifyUrl(siteUrl, hashedToken, { portal: options.portal })

  const sendResult = await sendInviteEmail({
    recipientEmail: normalizedEmail,
    inviteUrl,
    settings,
    resendApiKey: deps.resendApiKey,
    resendFromEmail: deps.resendFromEmail,
    siteUrl,
    role: options.role,
    fetch: deps.fetch,
  })

  if (!sendResult.success) {
    // generateLink already created the auth user — inviteUserByEmail cannot resend for them.
    console.warn('[requestUserInvite] Resend send failed after user was provisioned:', sendResult.error)
    return { sent: false, channel: 'resend', userId, error: sendResult.error }
  }

  return { sent: true, channel: 'resend', userId }
}