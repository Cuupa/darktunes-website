/**
 * src/lib/api/streamingStats.ts
 *
 * Data Access Layer for the `streaming_stats` table.
 *
 * Streaming stats are monthly platform stream counts per artist.
 * RLS ensures artists can only read their own stats.
 * Only admins can insert/update rows (label-managed data).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type StreamingStatRow = Database['public']['Tables']['streaming_stats']['Row']

// ---------------------------------------------------------------------------
// Domain type
// ---------------------------------------------------------------------------

export interface StreamingStat {
  id: string
  artistId: string
  platform: string
  period: string
  streams: number
  createdAt: string
}

export interface PlatformAggregate {
  platform: string
  totalStreams: number
}

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToStreamingStat(row: StreamingStatRow): StreamingStat {
  return {
    id: row.id,
    artistId: row.artist_id,
    platform: row.platform,
    period: row.period,
    streams: row.streams,
    createdAt: row.created_at,
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetches all streaming stats for a given artist, ordered newest period first.
 */
export async function getStreamingStatsByArtistId(
  db: DbClient,
  artistId: string,
): Promise<StreamingStat[]> {
  const { data, error } = await db
    .from('streaming_stats')
    .select('*')
    .eq('artist_id', artistId)
    .order('period', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => rowToStreamingStat(row as StreamingStatRow))
}

/**
 * Pure aggregation utility — sums streams per platform from a list of stats.
 * Kept separate from DB access so it can be tested in isolation.
 */
export function getAggregatedStreamsByPlatform(stats: StreamingStat[]): PlatformAggregate[] {
  const totals = new Map<string, number>()
  for (const stat of stats) {
    totals.set(stat.platform, (totals.get(stat.platform) ?? 0) + stat.streams)
  }
  return Array.from(totals.entries()).map(([platform, totalStreams]) => ({
    platform,
    totalStreams,
  }))
}

export interface UpsertStreamingStatInput {
  artistId: string
  platform: string
  period: string
  streams: number
}

/**
 * Upserts monthly platform stream totals (rolled up from territory metrics).
 */
export async function upsertStreamingStats(
  db: DbClient,
  rows: UpsertStreamingStatInput[],
): Promise<number> {
  if (rows.length === 0) return 0

  const payload = rows.map((r) => ({
    artist_id: r.artistId,
    platform: r.platform,
    period: r.period,
    streams: r.streams,
  }))

  const { error } = await db
    .from('streaming_stats')
    .upsert(payload, { onConflict: 'artist_id,platform,period' })

  if (error) throw new Error(error.message)
  return rows.length
}
