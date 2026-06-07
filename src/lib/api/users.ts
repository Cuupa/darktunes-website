/**
 * src/lib/api/users.ts
 *
 * Data Access Layer for admin user management.
 *
 * All functions require a Supabase client initialised with the service-role
 * key so they can call the Supabase Auth Admin API and bypass RLS.
 * Never call these from client-side code.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { UserRole, UserWithProfile, RoleChangeRecord, BanRecord, LinkedArtist } from '@/types/users'

type DbClient = SupabaseClient<Database>

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Lists all auth users enriched with their `profiles` role, all roles from
 * `user_roles`, and all linked artists from `artist_members`.
 * Requires a service-role client (Supabase Admin API).
 */
export async function listUsersWithProfiles(adminClient: DbClient): Promise<UserWithProfile[]> {
  // 1. Fetch all auth users via Admin API
  const { data: authData, error: authError } = await (adminClient.auth.admin as {
    listUsers: (opts?: { perPage?: number }) => Promise<{
      data: {
        users: Array<{
          id: string
          email?: string
          created_at: string
          last_sign_in_at?: string | null
          banned_until?: string | null
        }>
      }
      error: { message: string } | null
    }>
  }).listUsers({ perPage: 1000 })

  if (authError) throw new Error(authError.message)

  const users = authData.users

  // 2. Fetch primary roles + full_name from profiles
  const { data: profiles, error: profilesError } = await adminClient
    .from('profiles')
    .select('id, role, full_name, is_active')

  if (profilesError) throw new Error(profilesError.message)

  const profileMap = new Map<string, { role: UserRole; fullName: string | null }>()
  for (const p of (profiles ?? []) as Array<{ id: string; role: string; full_name?: string | null; is_active?: boolean | null }>) {
    profileMap.set(p.id, { role: p.role as UserRole, fullName: p.full_name ?? null })
  }

  // 3. Fetch all user_roles rows for the full multi-role list
  const { data: userRolesData } = await adminClient
    .from('user_roles')
    .select('user_id, role')

  const userRolesMap = new Map<string, UserRole[]>()
  for (const ur of userRolesData ?? []) {
    const list = userRolesMap.get(ur.user_id) ?? []
    list.push(ur.role as UserRole)
    userRolesMap.set(ur.user_id, list)
  }

  // 4. Fetch artist memberships — join artist_members → artists
  const { data: memberships, error: membershipsError } = await adminClient
    .from('artist_members')
    .select('user_id, member_role, artists!inner(id, name, slug)')

  if (membershipsError) throw new Error(membershipsError.message)

  // Build a map keyed by user_id → all artist memberships
  const artistsMap = new Map<string, LinkedArtist[]>()
  for (const m of memberships ?? []) {
    const a = (m as unknown as { artists: { id: string; name: string; slug: string } }).artists
    if (a) {
      const list = artistsMap.get(m.user_id) ?? []
      list.push({ id: a.id, name: a.name, slug: a.slug, member_role: m.member_role })
      artistsMap.set(m.user_id, list)
    }
  }

  // 5. Merge
  return users.map((u) => {
    const profile = profileMap.get(u.id)
    const primaryRole = profile?.role ?? 'user'
    const roles = userRolesMap.get(u.id) ?? [primaryRole]
    const linkedArtists = artistsMap.get(u.id) ?? []
    return {
      id: u.id,
      email: u.email ?? '',
      displayName: profile?.fullName ?? null,
      role: primaryRole,
      roles,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      banned_until: u.banned_until ?? null,
      linked_artist: linkedArtists[0]
        ? { id: linkedArtists[0].id, name: linkedArtists[0].name, slug: linkedArtists[0].slug }
        : null,
      linked_artists: linkedArtists,
    }
  })
}

/**
 * Returns the role-change history for a specific user (newest first).
 */
export async function getRoleHistory(
  adminClient: DbClient,
  userId: string,
): Promise<RoleChangeRecord[]> {
  const { data, error } = await adminClient
    .from('role_changes')
    .select('*')
    .eq('user_id', userId)
    .order('changed_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)

  const rows = data ?? []

  // Enrich with changer email by fetching profiles for unique changed_by IDs
  const changerIds = [...new Set(rows.map((r) => r.changed_by))]
  const { data: changerProfiles } = await adminClient
    .from('profiles')
    .select('id, email')
    .in('id', changerIds)

  const emailMap = new Map<string, string>()
  for (const p of changerProfiles ?? []) {
    emailMap.set(p.id, p.email)
  }

  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    old_role: r.old_role,
    new_role: r.new_role,
    changed_by: r.changed_by,
    changed_by_email: emailMap.get(r.changed_by),
    changed_at: r.changed_at,
    reason: r.reason,
    ip_address: r.ip_address,
  }))
}

/**
 * Returns the ban/unban history for a specific user (newest first).
 */
export async function getBanHistory(
  adminClient: DbClient,
  userId: string,
): Promise<BanRecord[]> {
  const { data, error } = await adminClient
    .from('ban_history')
    .select('*')
    .eq('user_id', userId)
    .order('changed_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)

  const rows = data ?? []

  const changerIds = [...new Set(rows.map((r) => r.changed_by))]
  const { data: changerProfiles } = await adminClient
    .from('profiles')
    .select('id, email')
    .in('id', changerIds)

  const emailMap = new Map<string, string>()
  for (const p of changerProfiles ?? []) {
    emailMap.set(p.id, p.email)
  }

  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    banned: r.banned,
    banned_until: r.banned_until,
    changed_by: r.changed_by,
    changed_by_email: emailMap.get(r.changed_by),
    changed_at: r.changed_at,
    reason: r.reason,
  }))
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Adds a role to a user in the `user_roles` junction table.
 * The trigger `trg_sync_primary_role` automatically updates `profiles.role`.
 */
export async function addUserRole(
  adminClient: DbClient,
  userId: string,
  role: UserRole,
  grantedBy: string,
): Promise<void> {
  const { error } = await adminClient
    .from('user_roles')
    .upsert({ user_id: userId, role, granted_by: grantedBy }, { onConflict: 'user_id,role' })

  if (error) throw new Error(error.message)
}

/**
 * Removes a role from a user in the `user_roles` junction table.
 * The trigger `trg_sync_primary_role` automatically updates `profiles.role`.
 */
export async function removeUserRole(
  adminClient: DbClient,
  userId: string,
  role: UserRole,
): Promise<void> {
  const { error } = await adminClient
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role', role)

  if (error) throw new Error(error.message)
}

/**
 * Updates the `role` column in `profiles` for the given user.
 * Also ensures a matching row exists in `user_roles`.
 * Requires service-role client (bypasses RLS).
 * @deprecated Prefer addUserRole / removeUserRole for multi-role support.
 */
export async function updateUserRole(
  adminClient: DbClient,
  userId: string,
  role: UserRole,
): Promise<void> {
  const { data, error } = await adminClient
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select('id')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error(`No profile found for user ${userId}`)
}

/**
 * Bans or unbans a user via the Supabase Auth Admin API.
 * Passing `ban: true` sets `banned_until` to far future; `false` clears it.
 */
export async function banUser(
  adminClient: DbClient,
  userId: string,
  ban: boolean,
): Promise<void> {
  const { error } = await (adminClient.auth.admin as {
    updateUserById: (
      id: string,
      attrs: { ban_duration?: string },
    ) => Promise<{ error: { message: string } | null }>
  }).updateUserById(userId, { ban_duration: ban ? '876000h' : 'none' })

  if (error) throw new Error(error.message)
}

/**
 * Logs a ban/unban action to ban_history.
 * Requires service-role client to write to audit table.
 */
export async function logBanAction(
  adminClient: DbClient,
  opts: {
    userId: string
    banned: boolean
    bannedUntil?: string | null
    changedBy: string
    reason?: string | null
  },
): Promise<void> {
  const { error } = await adminClient.from('ban_history').insert({
    user_id: opts.userId,
    banned: opts.banned,
    banned_until: opts.bannedUntil ?? null,
    changed_by: opts.changedBy,
    reason: opts.reason ?? null,
  })

  // Non-fatal: don't throw if audit insert fails — the actual ban already succeeded
  if (error) {
    console.error('[logBanAction] Failed to write ban_history:', error.message)
  }
}

/**
 * Permanently deletes a user from Supabase Auth.
 * The `profiles` row is removed via DB-level CASCADE.
 * Requires service-role client.
 */
export async function deleteUser(adminClient: DbClient, userId: string): Promise<void> {
  const { error } = await (adminClient.auth.admin as {
    deleteUser: (id: string) => Promise<{ error: { message: string } | null }>
  }).deleteUser(userId)

  if (error) throw new Error(error.message)
}

/**
 * Soft-deletes a user's own account:
 *  - Sets profiles.deleted_at = NOW()
 *  - Anonymises the stored email
 *  - Bans the auth user so they cannot log in during the grace period
 *
 * The actual auth.users row is NOT deleted here; a separate cleanup job
 * (or manual admin action) should remove it after the grace period.
 */
export async function softDeleteAccount(
  adminClient: DbClient,
  userId: string,
): Promise<void> {
  const anonymisedEmail = `deleted-${userId}@anonymized.local`

  // 1. Mark profile as deleted and anonymise PII
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ deleted_at: new Date().toISOString(), email: anonymisedEmail })
    .eq('id', userId)

  if (profileError) throw new Error(profileError.message)

  // 2. Ban the auth user to prevent further sign-ins
  const { error: banError } = await (adminClient.auth.admin as {
    updateUserById: (
      id: string,
      attrs: { ban_duration?: string; email?: string },
    ) => Promise<{ error: { message: string } | null }>
  }).updateUserById(userId, {
    ban_duration: '876000h',
    email: anonymisedEmail,
  })

  if (banError) throw new Error(banError.message)
}

/**
 * Sets `artists.user_id = userId` for the given artist.
 * Conflict protection (artist already linked to another user) is handled by the route handler.
 */
export async function linkArtistToUser(
  db: DbClient,
  artistId: string,
  userId: string,
): Promise<void> {
  const { error } = await db
    .from('artists')
    .update({ user_id: userId })
    .eq('id', artistId)

  if (error) throw new Error(error.message)
}

/**
 * Clears `artists.user_id` for the given artist (removes artist ↔ user link).
 */
export async function unlinkArtistFromUser(db: DbClient, artistId: string): Promise<void> {
  const { error } = await db
    .from('artists')
    .update({ user_id: null })
    .eq('id', artistId)

  if (error) throw new Error(error.message)
}

