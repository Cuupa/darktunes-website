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
import type { UserRole, UserWithProfile } from '@/types/users'

type DbClient = SupabaseClient<Database>

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Lists all auth users enriched with their `profiles` role and any linked
 * artist name.  Requires a service-role client (Supabase Admin API).
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

  // 2. Fetch all profiles (role)
  const { data: profiles, error: profilesError } = await adminClient
    .from('profiles')
    .select('id, role')

  if (profilesError) throw new Error(profilesError.message)

  const profileMap = new Map<string, UserRole>()
  for (const p of profiles ?? []) {
    profileMap.set(p.id, p.role as UserRole)
  }

  // 3. Fetch all artists that have a linked user_id
  const { data: artists, error: artistsError } = await adminClient
    .from('artists')
    .select('id, name, slug, user_id')
    .not('user_id', 'is', null)

  if (artistsError) throw new Error(artistsError.message)

  const artistMap = new Map<string, { id: string; name: string; slug: string }>()
  for (const a of artists ?? []) {
    if (a.user_id) {
      artistMap.set(a.user_id, { id: a.id, name: a.name, slug: a.slug })
    }
  }

  // 4. Merge
  return users.map((u) => ({
    id: u.id,
    email: u.email ?? '',
    role: profileMap.get(u.id) ?? 'user',
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    banned_until: u.banned_until ?? null,
    linked_artist: artistMap.get(u.id) ?? null,
  }))
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Updates the `role` column in `profiles` for the given user.
 * Requires service-role client (bypasses RLS).
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
