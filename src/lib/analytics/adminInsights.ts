/**
 * Admin-side revenue insights from SOS ArtistRevenue[].
 */

import type { ArtistRevenue } from '@/lib/sos/types'
import { GROWTH_SIGNIFICANT_PCT } from './constants'

export interface AdminRevenueKpis {
  totalRevenue: number
  totalPayout: number
  artistCount: number
  believeTotal: number
  bandcampTotal: number
  darkmerchTotal: number
  topArtist: string | null
  topCountry: string | null
}

export interface AdminRevenueInsight {
  id: string
  label: string
  detail: string
  severity: 'positive' | 'negative' | 'info'
}

export function computeAdminRevenueKpis(revenues: ArtistRevenue[]): AdminRevenueKpis {
  let totalRevenue = 0
  let totalPayout = 0
  let believeTotal = 0
  let bandcampTotal = 0
  let darkmerchTotal = 0
  const countryTotals = new Map<string, number>()

  for (const r of revenues) {
    totalRevenue += r.totalRevenue
    totalPayout += r.finalAmount
    believeTotal += r.believeRevenue
    bandcampTotal += r.bandcampRevenue
    darkmerchTotal += r.darkmerchRevenue
    for (const c of r.countryBreakdown) {
      if (!c.country) continue
      countryTotals.set(c.country, (countryTotals.get(c.country) ?? 0) + c.revenue)
    }
  }

  const topArtist =
    revenues.length > 0
      ? [...revenues].sort((a, b) => b.totalRevenue - a.totalRevenue)[0]!.artist
      : null

  const topCountry =
    countryTotals.size > 0
      ? [...countryTotals.entries()].sort((a, b) => b[1] - a[1])[0]![0]
      : null

  return {
    totalRevenue,
    totalPayout,
    artistCount: revenues.length,
    believeTotal,
    bandcampTotal,
    darkmerchTotal,
    topArtist,
    topCountry,
  }
}

export function computeAdminRevenueInsights(revenues: ArtistRevenue[]): AdminRevenueInsight[] {
  const insights: AdminRevenueInsight[] = []
  const kpis = computeAdminRevenueKpis(revenues)

  if (kpis.totalRevenue > 0) {
    const believeShare = (kpis.believeTotal / kpis.totalRevenue) * 100
    const bandcampShare = (kpis.bandcampTotal / kpis.totalRevenue) * 100
    const merchShare = (kpis.darkmerchTotal / kpis.totalRevenue) * 100

    if (believeShare >= GROWTH_SIGNIFICANT_PCT) {
      insights.push({
        id: 'believe-dominant',
        label: 'DSP-heavy mix',
        detail: `Believe (DSP) accounts for ${believeShare.toFixed(1)}% of gross revenue.`,
        severity: 'info',
      })
    }
    if (bandcampShare >= GROWTH_SIGNIFICANT_PCT) {
      insights.push({
        id: 'bandcamp-strong',
        label: 'Direct sales strength',
        detail: `Bandcamp contributes ${bandcampShare.toFixed(1)}% of revenue — strong direct-to-fan channel.`,
        severity: 'positive',
      })
    }
    if (merchShare >= GROWTH_SIGNIFICANT_PCT) {
      insights.push({
        id: 'merch-correlation',
        label: 'Merch revenue signal',
        detail: `Merch (Darkmerch) is ${merchShare.toFixed(1)}% of revenue — correlate with tour dates for promo impact.`,
        severity: 'positive',
      })
    }
  }

  const sorted = [...revenues].sort((a, b) => b.totalRevenue - a.totalRevenue)
  if (sorted.length >= 2 && sorted[0]!.totalRevenue > 0) {
    const leaderShare = (sorted[0]!.totalRevenue / kpis.totalRevenue) * 100
    if (leaderShare >= 50) {
      insights.push({
        id: 'concentration',
        label: 'Revenue concentration',
        detail: `${sorted[0]!.artist} drives ${leaderShare.toFixed(1)}% of label revenue this period.`,
        severity: 'info',
      })
    }
  }

  return insights
}

export function buildAdminRevenueCsv(revenues: ArtistRevenue[]): string {
  const header = [
    'artist',
    'total_revenue',
    'payout',
    'believe',
    'bandcamp',
    'darkmerch',
    'streams',
    'downloads',
    'physical',
  ].join(',')
  const rows = revenues.map((r) =>
    [
      `"${r.artist.replace(/"/g, '""')}"`,
      r.totalRevenue.toFixed(2),
      r.finalAmount.toFixed(2),
      r.believeRevenue.toFixed(2),
      r.bandcampRevenue.toFixed(2),
      r.darkmerchRevenue.toFixed(2),
      r.totalStreamRevenue.toFixed(2),
      r.totalDownloadRevenue.toFixed(2),
      r.physicalReleasesRevenue.toFixed(2),
    ].join(','),
  )
  return [header, ...rows].join('\n')
}

export function matchesAdminSearch(query: string, revenue: ArtistRevenue): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (revenue.artist.toLowerCase().includes(q)) return true
  return revenue.countryBreakdown.some((c) => c.country.toLowerCase().includes(q))
}