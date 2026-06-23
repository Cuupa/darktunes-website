import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>

/**
 * Returns true when the user has at least one row in artist_members.
 * Used by portal middleware to gate access without relying on JWT app_metadata.
 */
export async function hasPortalArtistMembership(db: DbClient, userId: string): Promise<boolean> {
  const { data, error } = await db
    .from('artist_members')
    .select('artist_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data !== null
}