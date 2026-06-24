/**
 * src/lib/api/promoImpact.ts — Precomputed promo log ↔ stream impact facts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type Row = Database['public']['Tables']['promo_impact']['Row']

export interface PromoImpact {
  id: string
  promoLogId: string
  artistId: string
  windowDays: number
  streamsBefore: number
  streamsAfter: number
  deltaStreams: number
  deltaPct: number
  revenueBefore: number
  revenueAfter: number
  calculatedAt: string
}

export interface UpsertPromoImpactInput {
  promoLogId: string
  artistId: string
  windowDays: number
  streamsBefore: number
  streamsAfter: number
  deltaStreams: number
  deltaPct: number
  revenueBefore: number
  revenueAfter: number
}

function rowToPromoImpact(row: Row): PromoImpact {
  return {
    id: row.id,
    promoLogId: row.promo_log_id,
    artistId: row.artist_id,
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

export async function getPromoImpactByArtistId(
  db: DbClient,
  artistId: string,
): Promise<PromoImpact[]> {
  const { data, error } = await db
    .from('promo_impact')
    .select('*')
    .eq('artist_id', artistId)
    .order('delta_pct', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => rowToPromoImpact(row as Row))
}

export async function upsertPromoImpactRows(
  db: DbClient,
  rows: UpsertPromoImpactInput[],
): Promise<number> {
  if (rows.length === 0) return 0

  const payload = rows.map((r) => ({
    promo_log_id: r.promoLogId,
    artist_id: r.artistId,
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
    .from('promo_impact')
    .upsert(payload, { onConflict: 'promo_log_id,window_days' })

  if (error) throw new Error(error.message)
  return rows.length
}