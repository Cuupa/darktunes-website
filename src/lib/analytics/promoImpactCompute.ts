/**
 * Computes correlational promo impact from territory metrics and promo log entries.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getPromoLogEntries } from '@/lib/api/promoLog'
import { getTerritoryMetricsByArtistId } from '@/lib/api/artistTerritoryMetrics'
import { upsertPromoImpactRows, type UpsertPromoImpactInput } from '@/lib/api/promoImpact'
import { EVENT_IMPACT_WINDOW_DAYS } from '@/lib/analytics/constants'

type DbClient = SupabaseClient<Database>

const MONTH_RE = /^\d{4}-\d{2}$/

function monthToIndex(period: string): number {
  const [y, m] = period.split('-').map(Number)
  return y * 12 + (m - 1)
}

function monthsInWindow(centerDate: string, windowDays: number): { before: string[]; after: string[] } {
  const center = new Date(centerDate)
  const beforeStart = new Date(center)
  beforeStart.setDate(beforeStart.getDate() - windowDays)
  const afterEnd = new Date(center)
  afterEnd.setDate(afterEnd.getDate() + windowDays)

  const beforeMonths = new Set<string>()
  const afterMonths = new Set<string>()

  const cursor = new Date(beforeStart.getFullYear(), beforeStart.getMonth(), 1)
  const end = new Date(afterEnd.getFullYear(), afterEnd.getMonth(), 1)

  while (cursor <= end) {
    const period = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    if (!MONTH_RE.test(period)) {
      cursor.setMonth(cursor.getMonth() + 1)
      continue
    }
    const idx = monthToIndex(period)
    const centerIdx = monthToIndex(
      `${center.getFullYear()}-${String(center.getMonth() + 1).padStart(2, '0')}`,
    )
    if (idx < centerIdx) beforeMonths.add(period)
    if (idx > centerIdx) afterMonths.add(period)
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return {
    before: Array.from(beforeMonths),
    after: Array.from(afterMonths),
  }
}

function sumAllMetrics(
  metrics: Awaited<ReturnType<typeof getTerritoryMetricsByArtistId>>,
  periods: string[],
): { streams: number; revenue: number } {
  let streams = 0
  let revenue = 0
  const periodSet = new Set(periods)
  for (const m of metrics) {
    if (!periodSet.has(m.period)) continue
    streams += m.streams
    revenue += m.revenueEur
  }
  return { streams, revenue }
}

export async function computePromoImpactForArtist(
  db: DbClient,
  artistId: string,
  options?: { windowDays?: number },
): Promise<number> {
  const windowDays = options?.windowDays ?? EVENT_IMPACT_WINDOW_DAYS
  const [promoEntries, metrics] = await Promise.all([
    getPromoLogEntries(db, artistId),
    getTerritoryMetricsByArtistId(db, artistId),
  ])

  if (promoEntries.length === 0 || metrics.length === 0) return 0

  const rows: UpsertPromoImpactInput[] = []

  for (const promo of promoEntries) {
    const { before, after } = monthsInWindow(promo.actionDate, windowDays)
    const beforeTotals = sumAllMetrics(metrics, before)
    const afterTotals = sumAllMetrics(metrics, after)
    const deltaStreams = afterTotals.streams - beforeTotals.streams
    const deltaPct =
      beforeTotals.streams > 0
        ? (deltaStreams / beforeTotals.streams) * 100
        : afterTotals.streams > 0
          ? 100
          : 0

    rows.push({
      promoLogId: promo.id,
      artistId,
      windowDays,
      streamsBefore: beforeTotals.streams,
      streamsAfter: afterTotals.streams,
      deltaStreams,
      deltaPct: Math.round(deltaPct * 100) / 100,
      revenueBefore: beforeTotals.revenue,
      revenueAfter: afterTotals.revenue,
    })
  }

  return upsertPromoImpactRows(db, rows)
}