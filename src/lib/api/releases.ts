import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Release } from '@/types'

type DbClient = SupabaseClient<Database>
type ReleaseRow = Database['public']['Tables']['releases']['Row']
export type ReleaseInsert = Database['public']['Tables']['releases']['Insert']
export type ReleaseUpdate = Database['public']['Tables']['releases']['Update']

function rowToRelease(row: ReleaseRow): Release {
  return {
    id: row.id,
    title: row.title,
    artistId: row.artist_id ?? '',
    artistName: row.artist_name,
    releaseDate: row.release_date,
    coverArt: row.cover_art ?? '',
    type: row.type,
    spotifyUrl: row.spotify_url ?? undefined,
    appleMusicUrl: row.apple_music_url ?? undefined,
    youtubeUrl: row.youtube_url ?? undefined,
    featured: row.featured,
    itunesId: row.itunes_id ?? undefined,
    spotifyId: row.spotify_id ?? undefined,
    discogsId: row.discogs_id ?? undefined,
    isrc: row.isrc ?? undefined,
    barcode: row.barcode ?? undefined,
    catalogNumber: row.catalog_number ?? undefined,
    previewUrl: row.preview_url ?? undefined,
    smartUrl: row.smart_url ?? undefined,
    popularity: row.popularity ?? undefined,
  }
}

export async function getReleasesByArtistId(db: DbClient, artistId: string): Promise<Release[]> {
  const { data, error } = await db
    .from('releases')
    .select('*')
    .eq('artist_id', artistId)
    .order('release_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToRelease)
}

export async function getReleases(db: DbClient): Promise<Release[]> {
  const { data, error } = await db
    .from('releases')
    .select('*')
    .order('release_date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToRelease)
}

export async function getReleaseById(db: DbClient, id: string): Promise<Release | null> {
  const { data, error } = await db.from('releases').select('*').eq('id', id).single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data ? rowToRelease(data) : null
}

export async function createRelease(db: DbClient, releaseData: ReleaseInsert): Promise<Release> {
  const { data, error } = await db.from('releases').insert(releaseData).select().single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from createRelease')
  return rowToRelease(data)
}

export async function updateRelease(
  db: DbClient,
  id: string,
  releaseData: ReleaseUpdate,
): Promise<Release> {
  const { data, error } = await db
    .from('releases')
    .update(releaseData)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from updateRelease')
  return rowToRelease(data)
}

export async function deleteRelease(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('releases').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function upsertReleaseByItunesId(
  db: DbClient,
  releaseData: ReleaseInsert,
): Promise<Release> {
  const { data, error } = await db
    .from('releases')
    .upsert(releaseData, { onConflict: 'itunes_id' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No data returned from upsertReleaseByItunesId')
  return rowToRelease(data)
}
