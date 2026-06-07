/**
 * src/types/users.ts
 *
 * Domain types for the Admin User Management feature.
 * These supplement the database types in src/types/database.ts.
 */

export type UserRole = 'admin' | 'editor' | 'journalist' | 'user' | 'artist' | 'press'

export interface LinkedArtist {
  id: string
  name: string
  slug: string
  member_role: 'owner' | 'member' | 'guest'
}

export interface UserWithProfile {
  id: string
  email: string
  /** Full name from profiles table */
  displayName?: string | null
  /** Primary (highest-privilege) role — kept for backwards compatibility */
  role: UserRole
  /** All roles the user holds */
  roles: UserRole[]
  created_at: string
  last_sign_in_at: string | null
  banned_until: string | null
  /** @deprecated Use linked_artists instead */
  linked_artist: { id: string; name: string; slug: string } | null
  /** All artist memberships for this user */
  linked_artists: LinkedArtist[]
}

export interface RoleChangeRecord {
  id: string
  user_id: string
  old_role: string
  new_role: string
  changed_by: string
  changed_by_email?: string
  changed_at: string
  reason: string | null
  ip_address: string | null
}

export interface BanRecord {
  id: string
  user_id: string
  banned: boolean
  banned_until: string | null
  changed_by: string
  changed_by_email?: string
  changed_at: string
  reason: string | null
}
