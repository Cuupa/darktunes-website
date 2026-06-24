/**
 * Computes correlational event impact from territory metrics and concerts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getConcertsByArtistId } from '@/lib/api/concerts'
import { getTerritoryMetricsByArtistId } from '@/lib/api/artistTerritoryMetrics'
import { upsertEventImpactRows, type UpsertEventImpactInput } from '@/lib/api/eventImpact'
import { countriesMatch, normalizeCountryName } from '@/lib/analytics/countryNormalization'
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

function sumMetricsForCountry(
  metrics: Awaited<ReturnType<typeof getTerritoryMetricsByArtistId>>,
  country: string,
  periods: string[],
): { streams: number; revenue: number } {
  let streams = 0
  let revenue = 0
  const periodSet = new Set(periods)
  for (const m of metrics) {
    if (!periodSet.has(m.period)) continue
    if (!countriesMatch(m.country, country)) continue
    streams += m.streams
    revenue += m.revenueEur
  }
  return { streams, revenue }
}

export async function computeEventImpactForArtist(
  db: DbClient,
  artistId: string,
  options?: { windowDays?: number },
): Promise<number> {
  const windowDays = options?.windowDays ?? EVENT_IMPACT_WINDOW_DAYS
  const [concerts, metrics] = await Promise.all([
    getConcertsByArtistId(db, artistId),
    getTerritoryMetricsByArtistId(db, artistId),
  ])

  if (concerts.length === 0 || metrics.length === 0) return 0

  const rows: UpsertEventImpactInput[] = []

  for (const concert of concerts) {
    const country = normalizeCountryName(concert.venueCountry)
    if (!country) continue

    const { before, after } = monthsInWindow(concert.concertDate, windowDays)
    const beforeTotals = sumMetricsForCountry(metrics, country, before)
    const afterTotals = sumMetricsForCountry(metrics, country, after)
    const deltaStreams = afterTotals.streams - beforeTotals.streams
    const deltaPct =
      beforeTotals.streams > 0
        ? (deltaStreams / beforeTotals.streams) * 100
        : afterTotals.streams > 0
          ? 100
          : 0

    rows.push({
      concertId: concert.id,
      artistId,
      country,
      windowDays,
      streamsBefore: beforeTotals.streams,
      streamsAfter: afterTotals.streams,
      deltaStreams,
      deltaPct: Math.round(deltaPct * 100) / 100,
      revenueBefore: beforeTotals.revenue,
      revenueAfter: afterTotals.revenue,
    })
  }

  return upsertEventImpactRows(db, rows)
}