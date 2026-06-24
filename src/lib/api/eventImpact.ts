/**
 * src/lib/api/eventImpact.ts — Precomputed concert ↔ territory impact facts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['event_impact']['Row']

export interface EventImpact {
  id: string
  concertId: string
  artistId: string
  country: string
  windowDays: number
  streamsBefore: number
  streamsAfter: number
  deltaStreams: number
  deltaPct: number
  revenueBefore: number
  revenueAfter: number
  calculatedAt: string
}

export interface UpsertEventImpactInput {
  concertId: string
  artistId: string
  country: string
  windowDays: number
  streamsBefore: number
  streamsAfter: number
  deltaStreams: number
  deltaPct: number
  revenueBefore: number
  revenueAfter: number
}

function rowToEventImpact(row: Row): EventImpact {
  return {
    id: row.id,
    concertId: row.concert_id,
    artistId: row.artist_id,
    country: row.country,
    windowDays: row.window_days,
    streamsBefore: row.streams_before,
    streamsAfter: row.streams_after,
    deltaStreams: row.delta_streams,
    deltaPct: Number(row.delta_pct),
    revenueBefore: Number(row.revenue_before),
    revenueAfter: Number(row.revenue_after),
    calculatedAt: row.calculated_at,
  }
}

export async function getEventImpactByArtistId(
  db: DbClient,
  artistId: string,
): Promise<EventImpact[]> {
  const { data, error } = await db
    .from('event_impact')
    .select('*')
    .eq('artist_id', artistId)
    .order('delta_pct', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => rowToEventImpact(row as Row))
}

export async function upsertEventImpactRows(
  db: DbClient,
  rows: UpsertEventImpactInput[],
): Promise<number> {
  if (rows.length === 0) return 0

  const payload = rows.map((r) => ({
    concert_id: r.concertId,
    artist_id: r.artistId,
    country: r.country,
    window_days: r.windowDays,
    streams_before: r.streamsBefore,
    streams_after: r.streamsAfter,
    delta_streams: r.deltaStreams,
    delta_pct: r.deltaPct,
    revenue_before: r.revenueBefore,
    revenue_after: r.revenueAfter,
    calculated_at: new Date().toISOString(),
  }))

  const { error } = await db
    .from('event_impact')
    .upsert(payload, { onConflict: 'concert_id,country,window_days' })

  if (error) throw new Error(error.message)
  return rows.length
}