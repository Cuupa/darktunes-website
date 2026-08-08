/**
 * DAL for spotify_track_play_snapshots — public Spotify track play counts (Apify).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['spotify_track_play_snapshots']['Row']

export interface SpotifyTrackPlaySnapshot {
  id: string
  artistId: string
  releaseId: string | null
  spotifyTrackId: string
  spotifyAlbumId: string | null
  trackName: string | null
  playCount: number
  period: string
  scrapedAt: string
}

export interface UpsertSpotifyTrackPlayInput {
  artistId: string
  releaseId?: string | null
  spotifyTrackId: string
  spotifyAlbumId?: string | null
  trackName?: string | null
  playCount: number
  period: string
}

function rowToSnapshot(row: Row): SpotifyTrackPlaySnapshot {
  return {
    id: row.id,
    artistId: row.artist_id,
    releaseId: row.release_id,
    spotifyTrackId: row.spotify_track_id,
    spotifyAlbumId: row.spotify_album_id,
    trackName: row.track_name,
    playCount: row.play_count,
    period: row.period,
    scrapedAt: row.scraped_at,
  }
}

export async function getTrackPlaySnapshotsByArtistId(
  db: DbClient,
  artistId: string,
): Promise<SpotifyTrackPlaySnapshot[]> {
  const { data, error } = await db
    .from('spotify_track_play_snapshots')
    .select('*')
    .eq('artist_id', artistId)
    .order('period', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToSnapshot)
}

export async function upsertSpotifyTrackPlaySnapshots(
  db: DbClient,
  rows: UpsertSpotifyTrackPlayInput[],
): Promise<number> {
  if (rows.length === 0) return 0

  const scrapedAt = new Date().toISOString()
  const payload = rows.map((r) => ({
    artist_id: r.artistId,
    release_id: r.releaseId ?? null,
    spotify_track_id: r.spotifyTrackId,
    spotify_album_id: r.spotifyAlbumId ?? null,
    track_name: r.trackName ?? null,
    play_count: r.playCount,
    period: r.period,
    scraped_at: scrapedAt,
  }))

  // Chunk large upserts to stay under PostgREST payload limits
  const CHUNK = 500
  let total = 0
  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK)
    const { error } = await db
      .from('spotify_track_play_snapshots')
      .upsert(slice, { onConflict: 'spotify_track_id,period' })
    if (error) throw new Error(error.message)
    total += slice.length
  }
  return total
}
