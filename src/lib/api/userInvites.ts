/**
 * Durable invite tokens — validity controlled by site_settings.invite_link_expiry_hours.
 * Raw token is emailed; only the SHA-256 hash is stored.
 *
 * Security:
 * - 32-byte base64url tokens (~256 bits entropy)
 * - Hash-only storage (SHA-256)
 * - Atomic consume (accepted_at) prevents double-use races
 * - Open invites for the same email are revoked on re-issue
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { UserRole } from '@/types/users'
import { INVITABLE_ROLES } from '@/types/users'

type DbClient = SupabaseClient<Database>

/** Raw token: 32 bytes → 43 base64url chars (no padding). */
export const INVITE_RAW_TOKEN_BYTES = 32
const RAW_TOKEN_RE = /^[A-Za-z0-9_-]{40,50}$/

export interface UserInviteRow {
  id: string
  email: string
  role: UserRole
  token_hash: string
  portal: boolean
  artist_id: string | null
  granted_by: string | null
  auth_user_id: string | null
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateUserInviteInput {
  email: string
  role: UserRole
  portal?: boolean
  artistId?: string | null
  grantedBy: string
  authUserId?: string | null
  expiresAt: Date
}

export function isValidInviteRawTokenFormat(rawToken: string): boolean {
  return RAW_TOKEN_RE.test(rawToken)
}

export function hashInviteToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex')
}

export function generateInviteRawToken(): string {
  return randomBytes(INVITE_RAW_TOKEN_BYTES).toString('base64url')
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function assertInvitableRole(role: string): UserRole {
  if (!INVITABLE_ROLES.includes(role as (typeof INVITABLE_ROLES)[number])) {
    throw new Error(`Invalid invite role: ${role}`)
  }
  return role as UserRole
}

/** Constant-time hex compare (same length hashes). */
export function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex')
    const bb = Buffer.from(b, 'hex')
    if (ba.length !== bb.length || ba.length === 0) return false
    return timingSafeEqual(ba, bb)
  } catch {
    return false
  }
}

/** Revoke all open invites for an email so only the newest link works. */
export async function revokeOpenInvitesForEmail(db: DbClient, email: string): Promise<void> {
  const normalized = normalizeEmail(email)
  const now = new Date().toISOString()
  const { error } = await db
    .from('user_invites')
    .update({ revoked_at: now, updated_at: now })
    .eq('email', normalized)
    .is('accepted_at', null)
    .is('revoked_at', null)

  if (error) throw new Error(error.message)
}

/**
 * Create a new durable invite. Revokes previous open invites for the same email.
 * Returns the raw token (show once in email) and the row.
 */
export async function createUserInvite(
  db: DbClient,
  input: CreateUserInviteInput,
): Promise<{ rawToken: string; invite: UserInviteRow }> {
  const email = normalizeEmail(input.email)
  const role = assertInvitableRole(input.role)
  if (!(input.expiresAt instanceof Date) || Number.isNaN(input.expiresAt.getTime())) {
    throw new Error('Invalid invite expiry')
  }
  if (input.expiresAt.getTime() <= Date.now()) {
    throw new Error('Invite expiry must be in the future')
  }

  await revokeOpenInvitesForEmail(db, email)

  const rawToken = generateInviteRawToken()
  const tokenHash = hashInviteToken(rawToken)
  const now = new Date().toISOString()

  const { data, error } = await db
    .from('user_invites')
    .insert({
      email,
      role,
      token_hash: tokenHash,
      portal: input.portal ?? false,
      artist_id: input.artistId ?? null,
      granted_by: input.grantedBy,
      auth_user_id: input.authUserId ?? null,
      expires_at: input.expiresAt.toISOString(),
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return { rawToken, invite: data as UserInviteRow }
}

export async function findValidInviteByRawToken(
  db: DbClient,
  rawToken: string,
): Promise<UserInviteRow | null> {
  if (!isValidInviteRawTokenFormat(rawToken)) return null

  const tokenHash = hashInviteToken(rawToken)
  const { data, error } = await db
    .from('user_invites')
    .select('*')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .is('accepted_at', null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as UserInviteRow
  // Defense-in-depth: re-check hash equality in constant time
  if (!safeEqualHex(row.token_hash, tokenHash)) return null
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return null
  }
  return row
}

/**
 * Atomically mark invite accepted. Returns false if already consumed/revoked.
 */
export async function consumeInvite(db: DbClient, inviteId: string): Promise<boolean> {
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('user_invites')
    .update({ accepted_at: now, updated_at: now })
    .eq('id', inviteId)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return Boolean(data?.id)
}

/** @deprecated Prefer consumeInvite for race-safe one-time use. */
export async function markInviteAccepted(db: DbClient, inviteId: string): Promise<void> {
  const ok = await consumeInvite(db, inviteId)
  if (!ok) throw new Error('Invite already used or revoked')
}

/** Build the durable invite URL included in branded emails. */
export function buildDurableInviteUrl(siteUrl: string, rawToken: string): string {
  const base = siteUrl.replace(/\/$/, '')
  return `${base}/auth/invite?token=${encodeURIComponent(rawToken)}`
}
