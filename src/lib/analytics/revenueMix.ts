/**
 * Revenue category breakdown from territory metrics.
 */

import type { ArtistTerritoryMetric } from '@/lib/api/artistTerritoryMetrics'

export type RevenueCategory = 'digital' | 'physical' | 'merch' | 'direct'

export interface RevenueMixSlice {
  category: RevenueCategory
  revenueEur: number
  streams: number
  quantity: number
}

const MERCH_PLATFORM_RE = /darkmerch|shopify|printful|merch/i
const DIRECT_PLATFORM_RE = /bandcamp/i

export function categorizeTerritoryMetric(metric: ArtistTerritoryMetric): RevenueCategory {
  const platform = metric.platform.toLowerCase()
  if (MERCH_PLATFORM_RE.test(platform)) return 'merch'
  if (DIRECT_PLATFORM_RE.test(platform)) return 'direct'
  if (metric.streams > 0) return 'digital'
  if (metric.quantity > 0) return 'physical'
  return 'digital'
}

export function computeRevenueMix(metrics: ArtistTerritoryMetric[]): RevenueMixSlice[] {
  const buckets = new Map<RevenueCategory, RevenueMixSlice>()

  for (const metric of metrics) {
    const category = categorizeTerritoryMetric(metric)
    const existing = buckets.get(category) ?? {
      category,
      revenueEur: 0,
      streams: 0,
      quantity: 0,
    }
    existing.revenueEur += metric.revenueEur
    existing.streams += metric.streams
    existing.quantity += metric.quantity
    buckets.set(category, existing)
  }

  const order: RevenueCategory[] = ['digital', 'direct', 'physical', 'merch']
  return order
    .filter((c) => buckets.has(c))
    .map((c) => buckets.get(c)!)
}

export function totalRevenueFromMix(slices: RevenueMixSlice[]): number {
  return slices.reduce((sum, s) => sum + s.revenueEur, 0)
}