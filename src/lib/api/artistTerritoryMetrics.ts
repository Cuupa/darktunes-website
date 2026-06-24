/**
 * src/lib/api/artistTerritoryMetrics.ts — Gold-layer territory streaming facts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['artist_territory_metrics']['Row']

export interface ArtistTerritoryMetric {
  id: string
  artistId: string
  period: string
  platform: string
  country: string
  streams: number
  revenueEur: number
  quantity: number
  sourceBatchId: string | undefined
  updatedAt: string
}

export interface UpsertTerritoryMetricInput {
  artistId: string
  period: string
  platform: string
  country: string
  streams: number
  revenueEur: number
  quantity: number
  sourceBatchId?: string | null
}

function rowToMetric(row: Row): ArtistTerritoryMetric {
  return {
    id: row.id,
    artistId: row.artist_id,
    period: row.period,
    platform: row.platform,
    country: row.country,
    streams: row.streams,
    revenueEur: Number(row.revenue_eur),
    quantity: row.quantity,
    sourceBatchId: row.source_batch_id ?? undefined,
    updatedAt: row.updated_at,
  }
}

export async function getTerritoryMetricsByArtistId(
  db: DbClient,
  artistId: string,
): Promise<ArtistTerritoryMetric[]> {
  const { data, error } = await db
    .from('artist_territory_metrics')
    .select('*')
    .eq('artist_id', artistId)
    .order('period', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => rowToMetric(row as Row))
}

export async function upsertTerritoryMetrics(
  db: DbClient,
  rows: UpsertTerritoryMetricInput[],
): Promise<number> {
  if (rows.length === 0) return 0

  const payload = rows.map((r) => ({
    artist_id: r.artistId,
    period: r.period,
    platform: r.platform,
    country: r.country,
    streams: r.streams,
    revenue_eur: r.revenueEur,
    quantity: r.quantity,
    source_batch_id: r.sourceBatchId ?? null,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await db
    .from('artist_territory_metrics')
    .upsert(payload, { onConflict: 'artist_id,period,platform,country' })

  if (error) throw new Error(error.message)
  return rows.length
}

export interface CountryAggregate {
  country: string
  totalStreams: number
  totalRevenueEur: number
}

export function aggregateMetricsByCountry(metrics: ArtistTerritoryMetric[]): CountryAggregate[] {
  const totals = new Map<string, { streams: number; revenue: number }>()
  for (const m of metrics) {
    if (!m.country) continue
    const existing = totals.get(m.country) ?? { streams: 0, revenue: 0 }
    totals.set(m.country, {
      streams: existing.streams + m.streams,
      revenue: existing.revenue + m.revenueEur,
    })
  }
  return Array.from(totals.entries())
    .map(([country, { streams, revenue }]) => ({
      country,
      totalStreams: streams,
      totalRevenueEur: revenue,
    }))
    .sort((a, b) => b.totalStreams - a.totalStreams)
}