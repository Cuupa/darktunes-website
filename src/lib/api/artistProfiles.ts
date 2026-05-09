/**
 * src/lib/api/artistProfiles.ts
 *
 * Data Access Layer for the `artist_profiles` table.
 *
 * artist_profiles stores the artist-managed EPK (Electronic Press Kit) data.
 * Each row is linked 1-to-1 with an artist. RLS ensures only the owning
 * Supabase Auth user can read/update their own profile row.
 *
 * Every function receives a SupabaseClient<Database> as its first argument
 * (Inversion of Control) — never imports the global singleton.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Artist } from '@/types'
import { rowToArtist } from './artistRowMapper'

type DbClient = SupabaseClient<Database>
type ArtistProfileRow = Database['public']['Tables']['artist_profiles']['Row']
type ArtistProfileInsert = Database['public']['Tables']['artist_profiles']['Insert']
type ArtistRow = Database['public']['Tables']['artists']['Row']

// ---------------------------------------------------------------------------
// Domain type
// ---------------------------------------------------------------------------

export interface ArtistProfile {
  id: string
  artistId: string
  bio: string | undefined
  photoUrl: string | undefined
  genres: string[]
  websiteUrl: string | undefined
  instagramUrl: string | undefined
  youtubeUrl: string | undefined
  bandcampUrl: string | undefined
  pressQuote: string | undefined
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToArtistProfile(row: ArtistProfileRow): ArtistProfile {
  return {
    id: row.id,
    artistId: row.artist_id,
    bio: row.bio ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    genres: row.genres,
    websiteUrl: row.website_url ?? undefined,
    instagramUrl: row.instagram_url ?? undefined,
    youtubeUrl: row.youtube_url ?? undefined,
    bandcampUrl: row.bandcamp_url ?? undefined,
    pressQuote: row.press_quote ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetches the EPK profile for a given artist ID.
 * Returns `null` if no profile row exists yet (PGRST116).
 */
export async function getArtistProfileByArtistId(
  db: DbClient,
  artistId: string,
): Promise<ArtistProfile | null> {
  const { data, error } = await db
    .from('artist_profiles')
    .select('*')
    .eq('artist_id', artistId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }

  return data ? rowToArtistProfile(data as ArtistProfileRow) : null
}

/**
 * Upserts (insert or update) the EPK profile for an artist.
 * Uses ON CONFLICT (artist_id) DO UPDATE so callers never need to know
 * whether the row already exists.
 */
export async function upsertArtistProfile(
  db: DbClient,
  profileData: ArtistProfileInsert,
): Promise<ArtistProfile> {
  const { data, error } = await db
    .from('artist_profiles')
    .upsert(profileData, { onConflict: 'artist_id' })
    .select()
    .single()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from upsertArtistProfile')

  return rowToArtistProfile(data as ArtistProfileRow)
}

/**
 * Looks up the artist record linked to a Supabase Auth user ID.
 * Returns `null` if the user is not linked to any artist.
 *
 * Used in the portal to identify which artist the logged-in user belongs to.
 */
export async function getArtistByUserId(db: DbClient, userId: string): Promise<Artist | null> {
  const { data, error } = await db
    .from('artists')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }

  return data ? rowToArtist(data as ArtistRow) : null
}
