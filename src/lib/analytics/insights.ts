/**
 * Pure analytics insight algorithms — testable, no UI dependencies.
 */

import type { ArtistListenerMetric } from '@/lib/api/artistListenerMetrics'
import type { ArtistTerritoryMetric } from '@/lib/api/artistTerritoryMetrics'
import type { EventImpact } from '@/lib/api/eventImpact'
import type { StreamingStat } from '@/lib/api/streamingStats'
import type { SalesStatement } from '@/lib/api/salesStatements'
import type { EpkDownloadStats } from '@/lib/api/epkDownloadEvents'
import type { ArtistPressDownloadStats } from '@/lib/api/journalistDownloads'
import type { ReleasePerformanceRow } from '@/lib/analytics/releasePerformance'
import type { PromoImpact } from '@/lib/api/promoImpact'
import {
  ANOMALY_Z_SCORE_THRESHOLD,
  CORRELATION_STRONG_THRESHOLD,
  GROWTH_SIGNIFICANT_PCT,
  TREND_MIN_PERIODS,
} from './constants'

export type InsightSeverity = 'positive' | 'negative' | 'neutral' | 'info'

export interface AnalyticsInsight {
  id: string
  severity: InsightSeverity
  titleKey: string
  bodyKey: string
  /** Interpolation values for i18n body strings */
  values?: Record<string, string | number>
}

export interface AnalyticsKpis {
  totalStreams: number
  totalRevenueEur: number
  topPlatform: string | null
  topCountry: string | null
  periodCount: number
  streamGrowthPct: number | null
  revenueGrowthPct: number | null
  listenerCorrelation: number | null
  pendingStatements: number
  totalEarningsEur: number
}

function sumStreamsByPeriod(stats: StreamingStat[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const s of stats) {
    map.set(s.period, (map.get(s.period) ?? 0) + s.streams)
  }
  return map
}

function sumRevenueByPeriod(metrics: ArtistTerritoryMetric[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const m of metrics) {
    map.set(m.period, (map.get(m.period) ?? 0) + m.revenueEur)
  }
  return map
}

function growthBetweenLastTwoPeriods(periodTotals: Map<string, number>): number | null {
  const periods = [...periodTotals.keys()].sort()
  if (periods.length < 2) return null
  const prev = periodTotals.get(periods[periods.length - 2]) ?? 0
  const last = periodTotals.get(periods[periods.length - 1]) ?? 0
  if (prev === 0) return last > 0 ? 100 : 0
  return Math.round(((last - prev) / prev) * 10000) / 100
}

function linearRegressionSlope(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += values[i]!
    sumXY += i * values[i]!
    sumXX += i * i
  }
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return 0
  return (n * sumXY - sumX * sumY) / denom
}

function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < TREND_MIN_PERIODS) return null
  const n = xs.length
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX
    const dy = ys[i]! - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  const denom = Math.sqrt(denX * denY)
  if (denom === 0) return null
  return Math.round((num / denom) * 1000) / 1000
}

function alignStreamsAndListeners(
  stats: StreamingStat[],
  listeners: ArtistListenerMetric[],
): { streams: number[]; listeners: number[] } {
  const streamByPeriod = sumStreamsByPeriod(stats)
  const listenerByPeriod = new Map<string, number>()
  for (const m of listeners) {
    listenerByPeriod.set(m.period, (listenerByPeriod.get(m.period) ?? 0) + m.value)
  }
  const periods = [...new Set([...streamByPeriod.keys(), ...listenerByPeriod.keys()])].sort()
  const streams: number[] = []
  const listenerVals: number[] = []
  for (const p of periods) {
    if (streamByPeriod.has(p) && listenerByPeriod.has(p)) {
      streams.push(streamByPeriod.get(p)!)
      listenerVals.push(listenerByPeriod.get(p)!)
    }
  }
  return { streams, listeners: listenerVals }
}

function detectStreamAnomaly(stats: StreamingStat[]): { period: string; z: number } | null {
  const byPeriod = sumStreamsByPeriod(stats)
  const periods = [...byPeriod.keys()].sort()
  if (periods.length < TREND_MIN_PERIODS) return null
  const values = periods.map((p) => byPeriod.get(p)!)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  const std = Math.sqrt(variance)
  if (std === 0) return null
  const lastPeriod = periods[periods.length - 1]!
  const lastVal = byPeriod.get(lastPeriod)!
  const z = (lastVal - mean) / std
  if (Math.abs(z) >= ANOMALY_Z_SCORE_THRESHOLD) {
    return { period: lastPeriod, z: Math.round(z * 100) / 100 }
  }
  return null
}

export function computeAnalyticsKpis(input: {
  stats: StreamingStat[]
  territoryMetrics: ArtistTerritoryMetric[]
  listenerMetrics: ArtistListenerMetric[]
  statements: SalesStatement[]
}): AnalyticsKpis {
  const { stats, territoryMetrics, listenerMetrics, statements } = input

  const totalStreams = stats.reduce((sum, s) => sum + s.streams, 0)
  const totalRevenueEur = territoryMetrics.reduce((sum, m) => sum + m.revenueEur, 0)

  const platformTotals = new Map<string, number>()
  for (const s of stats) {
    platformTotals.set(s.platform, (platformTotals.get(s.platform) ?? 0) + s.streams)
  }
  const topPlatform =
    platformTotals.size > 0
      ? [...platformTotals.entries()].sort((a, b) => b[1] - a[1])[0]![0]
      : null

  const countryTotals = new Map<string, number>()
  for (const m of territoryMetrics) {
    if (!m.country) continue
    countryTotals.set(m.country, (countryTotals.get(m.country) ?? 0) + m.streams)
  }
  const topCountry =
    countryTotals.size > 0
      ? [...countryTotals.entries()].sort((a, b) => b[1] - a[1])[0]![0]
      : null

  const periods = new Set<string>()
  for (const s of stats) periods.add(s.period)
  for (const m of territoryMetrics) periods.add(m.period)

  const streamGrowthPct = growthBetweenLastTwoPeriods(sumStreamsByPeriod(stats))
  const revenueGrowthPct = growthBetweenLastTwoPeriods(sumRevenueByPeriod(territoryMetrics))

  const aligned = alignStreamsAndListeners(stats, listenerMetrics)
  const listenerCorrelation = pearsonCorrelation(aligned.streams, aligned.listeners)

  const pendingStatements = statements.filter((s) => s.status === 'label_approved').length
  const totalEarningsEur = statements.reduce((sum, s) => sum + (s.amountEur ?? 0), 0)

  return {
    totalStreams,
    totalRevenueEur,
    topPlatform,
    topCountry,
    periodCount: periods.size,
    streamGrowthPct,
    revenueGrowthPct,
    listenerCorrelation,
    pendingStatements,
    totalEarningsEur,
  }
}

export function computeAnalyticsInsights(input: {
  stats: StreamingStat[]
  territoryMetrics: ArtistTerritoryMetric[]
  listenerMetrics: ArtistListenerMetric[]
  eventImpacts: EventImpact[]
  promoImpacts?: PromoImpact[]
  releaseRows?: ReleasePerformanceRow[]
  epkStats?: EpkDownloadStats
  pressStats?: ArtistPressDownloadStats
}): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = []
  const { stats, listenerMetrics, eventImpacts, promoImpacts, releaseRows, epkStats, pressStats } = input

  const streamByPeriod = sumStreamsByPeriod(stats)
  const periods = [...streamByPeriod.keys()].sort()
  if (periods.length >= TREND_MIN_PERIODS) {
    const values = periods.map((p) => streamByPeriod.get(p)!)
    const slope = linearRegressionSlope(values)
    if (slope > 0) {
      insights.push({
        id: 'trend-up',
        severity: 'positive',
        titleKey: 'analytics_insight_trend_up_title',
        bodyKey: 'analytics_insight_trend_up_body',
      })
    } else if (slope < 0) {
      insights.push({
        id: 'trend-down',
        severity: 'negative',
        titleKey: 'analytics_insight_trend_down_title',
        bodyKey: 'analytics_insight_trend_down_body',
      })
    }
  }

  const growth = growthBetweenLastTwoPeriods(streamByPeriod)
  if (growth !== null && Math.abs(growth) >= GROWTH_SIGNIFICANT_PCT) {
    insights.push({
      id: growth >= 0 ? 'mom-up' : 'mom-down',
      severity: growth >= 0 ? 'positive' : 'negative',
      titleKey: growth >= 0 ? 'analytics_insight_mom_up_title' : 'analytics_insight_mom_down_title',
      bodyKey: growth >= 0 ? 'analytics_insight_mom_up_body' : 'analytics_insight_mom_down_body',
      values: { pct: Math.abs(growth) },
    })
  }

  const aligned = alignStreamsAndListeners(stats, listenerMetrics)
  const corr = pearsonCorrelation(aligned.streams, aligned.listeners)
  if (corr !== null && Math.abs(corr) >= CORRELATION_STRONG_THRESHOLD) {
    insights.push({
      id: 'listener-corr',
      severity: corr > 0 ? 'positive' : 'info',
      titleKey: 'analytics_insight_listener_corr_title',
      bodyKey: 'analytics_insight_listener_corr_body',
      values: { corr: Math.abs(corr) },
    })
  }

  const anomaly = detectStreamAnomaly(stats)
  if (anomaly) {
    insights.push({
      id: 'anomaly',
      severity: anomaly.z > 0 ? 'positive' : 'negative',
      titleKey: 'analytics_insight_anomaly_title',
      bodyKey: 'analytics_insight_anomaly_body',
      values: { period: anomaly.period, z: Math.abs(anomaly.z) },
    })
  }

  const strongEvents = eventImpacts
    .filter((e) => Math.abs(e.deltaPct) >= GROWTH_SIGNIFICANT_PCT)
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
    .slice(0, 3)

  for (const ev of strongEvents) {
    insights.push({
      id: `event-${ev.concertId}-${ev.country}`,
      severity: ev.deltaPct >= 0 ? 'positive' : 'negative',
      titleKey: 'analytics_insight_event_title',
      bodyKey: 'analytics_insight_event_body',
      values: { country: ev.country, pct: Math.abs(ev.deltaPct) },
    })
  }

  const topRelease = releaseRows?.find((r) => r.releaseId && r.totalRevenueEur > 0)
  if (topRelease) {
    insights.push({
      id: 'top-release',
      severity: 'info',
      titleKey: 'analytics_insight_top_release_title',
      bodyKey: 'analytics_insight_top_release_body',
      values: {
        release: topRelease.releaseTitle,
        revenue: Math.round(topRelease.totalRevenueEur * 100) / 100,
      },
    })
  }

  if (epkStats && epkStats.last30Days >= 3) {
    insights.push({
      id: 'epk-momentum',
      severity: 'positive',
      titleKey: 'analytics_insight_epk_title',
      bodyKey: 'analytics_insight_epk_body',
      values: { count: epkStats.last30Days },
    })
  }

  if (pressStats && pressStats.last30Days >= 2) {
    insights.push({
      id: 'press-momentum',
      severity: 'positive',
      titleKey: 'analytics_insight_press_title',
      bodyKey: 'analytics_insight_press_body',
      values: { count: pressStats.last30Days },
    })
  }

  const strongPromo = promoImpacts
    ?.filter((p) => Math.abs(p.deltaPct) >= GROWTH_SIGNIFICANT_PCT)
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))[0]

  if (strongPromo) {
    insights.push({
      id: 'promo-impact',
      severity: strongPromo.deltaPct >= 0 ? 'positive' : 'negative',
      titleKey: 'analytics_insight_promo_impact_title',
      bodyKey: 'analytics_insight_promo_impact_body',
      values: { pct: Math.abs(strongPromo.deltaPct) },
    })
  }

  return insights
}

export function matchesQuickSearch(query: string, ...fields: (string | number | undefined | null)[]): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fields.some((f) => f !== undefined && f !== null && String(f).toLowerCase().includes(q))
}