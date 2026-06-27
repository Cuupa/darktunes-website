import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>

export interface PerformingArtist {
  artistId: string
  artistName: string
}

export async function getPerformingArtistsForStop(
  db: DbClient,
  stopId: string,
): Promise<PerformingArtist[]> {
  const { data, error } = await db
    .from('tour_stop_performing_artists')
    .select('artist_id')
    .eq('stop_id', stopId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  if (!data?.length) return []

  const artistIds = data.map((row) => row.artist_id)
  const { data: artists, error: artistsError } = await db
    .from('artists')
    .select('id, name')
    .in('id', artistIds)

  if (artistsError) throw new Error(artistsError.message)
  const artistMap = new Map((artists ?? []).map((a) => [a.id, a.name]))

  return data.map((row) => ({
    artistId: row.artist_id,
    artistName: artistMap.get(row.artist_id) ?? 'Unknown',
  }))
}

export async function setPerformingArtistsForStop(
  db: DbClient,
  stopId: string,
  artistIds: string[],
): Promise<void> {
  const { error: deleteError } = await db
    .from('tour_stop_performing_artists')
    .delete()
    .eq('stop_id', stopId)
  if (deleteError) throw new Error(deleteError.message)

  if (artistIds.length === 0) return

  const { error: insertError } = await db.from('tour_stop_performing_artists').insert(
    artistIds.map((artistId) => ({ stop_id: stopId, artist_id: artistId })),
  )
  if (insertError) throw new Error(insertError.message)
}

export async function getPerformingArtistIdsByStopIds(
  db: DbClient,
  stopIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (stopIds.length === 0) return map

  const { data, error } = await db
    .from('tour_stop_performing_artists')
    .select('stop_id, artist_id')
    .in('stop_id', stopIds)

  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const list = map.get(row.stop_id) ?? []
    list.push(row.artist_id)
    map.set(row.stop_id, list)
  }
  return map
}