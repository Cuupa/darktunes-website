/**
 * src/types/users.ts
 *
 * Domain types for the Admin User Management feature.
 * These supplement the database types in src/types/database.ts.
 */

export type UserRole = 'admin' | 'editor' | 'journalist' | 'user' | 'artist'

export interface UserWithProfile {
  id: string
  email: string
  role: UserRole
  created_at: string
  last_sign_in_at: string | null
  banned_until: string | null
  linked_artist: { id: string; name: string; slug: string } | null
}
