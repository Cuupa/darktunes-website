/**
 * DAL for artist_listener_metrics — external listener/play trends.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['artist_listener_metrics']['Row']

export type ListenerMetricSource = 'lastfm' | 'soundcharts'
export type ListenerMetricType = 'listeners' | 'plays'

export interface ArtistListenerMetric {
  id: string
  artistId: string
  source: ListenerMetricSource
  metricType: ListenerMetricType
  period: string
  value: number
  country: string
  fetchedAt: string
}

export interface UpsertListenerMetricInput {
  artistId: string
  source: ListenerMetricSource
  metricType: ListenerMetricType
  period: string
  value: number
  country?: string
}

function rowToMetric(row: Row): ArtistListenerMetric {
  return {
    id: row.id,
    artistId: row.artist_id,
    source: row.source as ListenerMetricSource,
    metricType: row.metric_type as ListenerMetricType,
    period: row.period,
    value: row.value,
    country: row.country,
    fetchedAt: row.fetched_at,
  }
}

export async function getListenerMetricsByArtistId(
  db: DbClient,
  artistId: string,
): Promise<ArtistListenerMetric[]> {
  const { data, error } = await db
    .from('artist_listener_metrics')
    .select('*')
    .eq('artist_id', artistId)
    .order('period', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToMetric)
}

export async function upsertListenerMetrics(
  db: DbClient,
  rows: UpsertListenerMetricInput[],
): Promise<number> {
  if (rows.length === 0) return 0

  const payload = rows.map((row) => ({
    artist_id: row.artistId,
    source: row.source,
    metric_type: row.metricType,
    period: row.period,
    value: row.value,
    country: row.country ?? '',
    fetched_at: new Date().toISOString(),
  }))

  const { error } = await db
    .from('artist_listener_metrics')
    .upsert(payload, { onConflict: 'artist_id,source,metric_type,period,country' })

  if (error) throw new Error(error.message)
  return rows.length
}