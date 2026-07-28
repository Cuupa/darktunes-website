/**
 * User invite: durable app-level invite tokens + branded Resend email when configured,
 * Supabase inviteUserByEmail fallback otherwise.
 *
 * Invite link validity is controlled by site_settings.invite_link_expiry_hours
 * (24–168 hours, default 168). The emailed link hits /auth/invite which exchanges
 * a still-valid durable token for a fresh Supabase invite OTP.
 */

import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getSiteSettings } from '@/lib/api/siteSettings'
import {
  buildDurableInviteUrl,
  createUserInvite,
} from '@/lib/api/userInvites'
import { syncInvitedUserAccess } from '@/lib/api/users'
import {
  getArtistInviteRedirectUrl,
  getUserInviteRedirectUrl,
} from '@/lib/auth/resolveRedirectPath'
import {
  computeInviteExpiresAt,
  normalizeInviteLinkExpiryHours,
} from '@/lib/auth/inviteLinkExpiry'
import { sendInviteEmail } from '@/lib/email/sendInviteEmail'
import type { Database } from '@/types/database'
import { INVITABLE_ROLES, type InvitableRole, type UserRole } from '@/types/users'

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
  expiresAt?: string
  error?: string
  /** true when this was a resend of an existing pending account */
  resent?: boolean
  /** Recipient email when known (artist invite/resend). */
  email?: string
  /** invite = first send, resend = re-issue for pending linked user */
  mode?: 'invite' | 'resend'
}

function isAlreadyRegistered(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes('already registered') || m.includes('already been registered')
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function assertInvitableRole(role: UserRole): InvitableRole {
  if (!INVITABLE_ROLES.includes(role as InvitableRole)) {
    throw new Error(`Role "${role}" cannot be invited`)
  }
  return role as InvitableRole
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

async function findAuthUserByEmail(
  client: DbClient,
  email: string,
): Promise<User | null> {
  const normalized = normalizeEmail(email)

  const { data: profile } = await client
    .from('users')
    .select('id')
    .eq('email', normalized)
    .maybeSingle()

  if (profile?.id) {
    const { data: authUser } = await client.auth.admin.getUserById(profile.id)
    if (authUser?.user) return authUser.user
  }

  // Profile email may not be lowercased on legacy rows — case-insensitive fallback.
  const { data: profileIlike } = await client
    .from('users')
    .select('id')
    .ilike('email', normalized)
    .maybeSingle()

  if (profileIlike?.id) {
    const { data: authUser } = await client.auth.admin.getUserById(profileIlike.id)
    if (authUser?.user) return authUser.user
  }

  // Rare: auth user without public.users row yet
  const perPage = 200
  let page = 1
  while (page <= 5) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage })
    if (error) break
    const match = data.users.find((u) => (u.email ?? '').toLowerCase() === normalized)
    if (match) return match
    if (data.users.length < perPage) break
    page += 1
  }
  return null
}

function hasSignedIn(user: User): boolean {
  return Boolean(user.last_sign_in_at)
}

/**
 * Ensure an auth user exists for the invite (unconfirmed until they accept).
 * Returns alreadyRegistered when the account has already signed in.
 */
async function ensureInvitedAuthUser(
  client: DbClient,
  options: RequestUserInviteOptions,
  siteUrl: string,
): Promise<
  | { ok: true; userId: string; user: User }
  | { ok: false; alreadyRegistered: true }
  | { ok: false; error: string }
> {
  const normalizedEmail = normalizeEmail(options.email)
  const redirectTo = options.portal
    ? getArtistInviteRedirectUrl(siteUrl)
    : getUserInviteRedirectUrl(siteUrl)
  const metadata = buildInviteMetadata(options)

  const existing = await findAuthUserByEmail(client, normalizedEmail)
  if (existing) {
    if (hasSignedIn(existing)) {
      return { ok: false, alreadyRegistered: true }
    }
    // Refresh invite-related metadata on pending accounts
    await client.auth.admin.updateUserById(existing.id, {
      user_metadata: { ...existing.user_metadata, ...metadata },
    })
    return { ok: true, userId: existing.id, user: existing }
  }

  // Prefer createUser so we do not burn a short-lived OTP we would discard.
  const { data: created, error: createError } = await client.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: false,
    user_metadata: metadata,
  })

  if (!createError && created?.user?.id) {
    return { ok: true, userId: created.user.id, user: created.user }
  }

  if (createError && isAlreadyRegistered(createError.message)) {
    const again = await findAuthUserByEmail(client, normalizedEmail)
    if (again) {
      if (hasSignedIn(again)) return { ok: false, alreadyRegistered: true }
      return { ok: true, userId: again.id, user: again }
    }
  }

  // Fallback: generateLink also creates the user for type=invite
  const { data, error } = await client.auth.admin.generateLink({
    type: 'invite',
    email: normalizedEmail,
    options: { redirectTo, data: metadata },
  })

  if (error) {
    if (isAlreadyRegistered(error.message)) {
      const again = await findAuthUserByEmail(client, normalizedEmail)
      if (again?.last_sign_in_at) return { ok: false, alreadyRegistered: true }
      if (again) return { ok: true, userId: again.id, user: again }
    }
    return { ok: false, error: error.message || createError?.message || 'Failed to provision user' }
  }

  const user = data?.user
  if (!user?.id) {
    return { ok: false, error: 'generateLink returned no user id' }
  }
  return { ok: true, userId: user.id, user }
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

async function sendBrandedDurableInvite(
  adminClient: DbClient,
  options: RequestUserInviteOptions,
  deps: RequestUserInviteDeps,
  userId: string,
  flags?: { resent?: boolean },
): Promise<RequestUserInviteResult> {
  const siteUrl = deps.siteUrl.replace(/\/$/, '')
  const settings = await getSiteSettings(adminClient)
  const expiryHours = normalizeInviteLinkExpiryHours(settings.inviteLinkExpiryHours)
  const expiresAt = computeInviteExpiresAt(expiryHours)
  const email = normalizeEmail(options.email)
  const role = assertInvitableRole(options.role)

  await syncInvitedUserAccess(
    adminClient,
    userId,
    role,
    options.grantedBy,
    options.artistId,
  )

  const { rawToken } = await createUserInvite(adminClient, {
    email,
    role,
    portal: options.portal,
    artistId: options.artistId,
    grantedBy: options.grantedBy,
    authUserId: userId,
    expiresAt,
  })

  const inviteUrl = buildDurableInviteUrl(siteUrl, rawToken)

  const sendResult = await sendInviteEmail({
    recipientEmail: email,
    inviteUrl,
    expiresAt,
    settings,
    resendApiKey: deps.resendApiKey!,
    resendFromEmail: deps.resendFromEmail,
    siteUrl,
    role,
    fetch: deps.fetch,
  })

  if (!sendResult.success) {
    console.warn('[requestUserInvite] Resend send failed after user was provisioned:', sendResult.error)
    return {
      sent: false,
      channel: 'resend',
      userId,
      expiresAt: expiresAt.toISOString(),
      error: sendResult.error,
      resent: flags?.resent,
    }
  }

  return {
    sent: true,
    channel: 'resend',
    userId,
    expiresAt: expiresAt.toISOString(),
    resent: flags?.resent,
  }
}

export async function requestUserInvite(
  adminClient: DbClient,
  options: RequestUserInviteOptions,
  deps: RequestUserInviteDeps,
): Promise<RequestUserInviteResult> {
  const normalizedEmail = normalizeEmail(options.email)
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return { sent: false, error: 'Invalid email address' }
  }

  try {
    assertInvitableRole(options.role)
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'Invalid role' }
  }

  const siteUrl = deps.siteUrl.replace(/\/$/, '')
  const opts = { ...options, email: normalizedEmail }

  if (!deps.resendApiKey) {
    console.warn(
      '[requestUserInvite] Resend not configured — falling back to Supabase invite email',
    )
    return sendViaSupabaseFallback(adminClient, opts, siteUrl)
  }

  const ensured = await ensureInvitedAuthUser(adminClient, opts, siteUrl)

  if (!ensured.ok) {
    if ('alreadyRegistered' in ensured && ensured.alreadyRegistered) {
      return { sent: false, alreadyRegistered: true, channel: 'resend' }
    }
    console.warn(
      '[requestUserInvite] ensureInvitedAuthUser failed — falling back to Supabase invite email:',
      'error' in ensured ? ensured.error : 'unknown',
    )
    return sendViaSupabaseFallback(adminClient, opts, siteUrl)
  }

  return sendBrandedDurableInvite(adminClient, opts, deps, ensured.userId)
}

export interface ResendUserInviteOptions {
  userId: string
  grantedBy: string
  /** Override role / portal / artist when known (e.g. artist resend). */
  role?: UserRole
  portal?: boolean
  artistId?: string
}

/**
 * Re-issue a durable invite for a user who has not signed in yet.
 * Always generates a new token and revokes previous open invites.
 */
export async function resendUserInvite(
  adminClient: DbClient,
  options: ResendUserInviteOptions,
  deps: RequestUserInviteDeps,
): Promise<RequestUserInviteResult> {
  if (!deps.resendApiKey) {
    return {
      sent: false,
      channel: 'resend',
      error: 'Resend is not configured — cannot resend branded invites',
    }
  }

  const { data: authData, error: authError } = await adminClient.auth.admin.getUserById(
    options.userId,
  )
  if (authError || !authData?.user) {
    return { sent: false, error: authError?.message ?? 'User not found' }
  }

  const user = authData.user
  if (hasSignedIn(user)) {
    return {
      sent: false,
      alreadyRegistered: true,
      error: 'User has already signed in — invite cannot be resent',
    }
  }

  const email = normalizeEmail(user.email ?? '')
  if (!email) {
    return { sent: false, error: 'User has no email address' }
  }

  const { data: profile } = await adminClient
    .from('users')
    .select('role')
    .eq('id', options.userId)
    .maybeSingle()

  const metaRole = (user.user_metadata?.role as string | undefined) ?? profile?.role
  const role = (options.role ?? metaRole ?? 'user') as UserRole
  const artistId =
    options.artistId ??
    (user.user_metadata?.artist_id as string | undefined) ??
    undefined
  const portal = options.portal ?? (role === 'artist' || Boolean(artistId))

  try {
    assertInvitableRole(role)
  } catch {
    // Pending accounts with non-invitable role still get a portal/recovery-style invite as user→editor? refuse.
    return { sent: false, error: `Cannot resend invite for role "${role}"` }
  }

  await adminClient.auth.admin.updateUserById(options.userId, {
    user_metadata: {
      ...user.user_metadata,
      role,
      ...(artistId ? { artist_id: artistId } : {}),
    },
  })

  return sendBrandedDurableInvite(
    adminClient,
    {
      email,
      role,
      portal,
      artistId,
      grantedBy: options.grantedBy,
    },
    deps,
    options.userId,
    { resent: true },
  )
}

export interface ResendArtistInviteOptions {
  artistId: string
  grantedBy: string
  /** Optional email override when artist.email is empty */
  emailOverride?: string | null
}

/**
 * Invite or resend portal invite for a roster artist.
 * - No user_id → create invite + link
 * - user_id but never signed in → resend new link
 * - already signed in → alreadyRegistered
 */
export async function inviteOrResendArtist(
  adminClient: DbClient,
  options: ResendArtistInviteOptions,
  deps: RequestUserInviteDeps,
): Promise<RequestUserInviteResult> {
  const { data: artist, error: artistError } = await adminClient
    .from('artists')
    .select('id, name, email, user_id')
    .eq('id', options.artistId)
    .maybeSingle()

  if (artistError || !artist) {
    return { sent: false, error: 'Artist not found' }
  }

  if (artist.user_id) {
    const { data: authData } = await adminClient.auth.admin.getUserById(artist.user_id)
    const authUser = authData?.user
    if (authUser && hasSignedIn(authUser)) {
      return {
        sent: false,
        alreadyRegistered: true,
        error: `Artist "${artist.name}" already has an active portal account.`,
      }
    }

    // Linked but never signed in → resend
    if (authUser) {
      const result = await resendUserInvite(
        adminClient,
        {
          userId: artist.user_id,
          grantedBy: options.grantedBy,
          role: 'artist',
          portal: true,
          artistId: artist.id,
        },
        deps,
      )
      return {
        ...result,
        email: authUser.email ?? artist.email ?? undefined,
        mode: 'resend',
      }
    }
    // Stale user_id — fall through to fresh invite after clearing link? Keep safe: try resend by email.
  }

  const email =
    (options.emailOverride?.trim() || artist.email || '').trim().toLowerCase() ||
    null

  if (!email) {
    return {
      sent: false,
      error: `Artist "${artist.name}" has no email address. Add an email before sending an invite.`,
    }
  }

  // If linked to a missing auth user, still invite by email (requestUserInvite reuses pending user if any)
  const result = await requestUserInvite(
    adminClient,
    {
      email,
      role: 'artist',
      portal: true,
      artistId: artist.id,
      grantedBy: options.grantedBy,
    },
    deps,
  )

  return { ...result, email, mode: 'invite' }
}
