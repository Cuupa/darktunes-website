import type { SalesTransaction } from '../ingest/csv-parser'
import type {
  ArtistTreeNode,
  PlatformRevenue,
  CountryRevenue,
  MonthlyRevenue,
  ReleaseRevenue,
  ReleaseWithTracks,
  TrackData,
} from '../types'
import type { ProcessedArtistData } from './types'

function aggregateBy<K extends string>(
  items: { key: K; revenue: number; quantity: number }[],
): Map<K, { revenue: number; quantity: number }> {
  const map = new Map<K, { revenue: number; quantity: number }>()
  for (const { key, revenue, quantity } of items) {
    const existing = map.get(key) ?? { revenue: 0, quantity: 0 }
    map.set(key, { revenue: existing.revenue + revenue, quantity: existing.quantity + quantity })
  }
  return map
}

export function buildPlatformBreakdown(transactions: SalesTransaction[]): PlatformRevenue[] {
  const map = new Map<string, { revenue: number; quantity: number; downloads: number; streams: number; hasTypeInfo: boolean }>()
  for (const t of transactions) {
    const key = t.platform || 'Unknown'
    const existing = map.get(key) ?? { revenue: 0, quantity: 0, downloads: 0, streams: 0, hasTypeInfo: false }
    const hasTypeInfo = !t.is_physical && t.is_download !== undefined
    map.set(key, {
      revenue: existing.revenue + t.net_revenue,
      quantity: existing.quantity + t.quantity,
      downloads: existing.downloads + (!t.is_physical && t.is_download === true ? t.quantity : 0),
      streams: existing.streams + (!t.is_physical && t.is_download === false ? t.quantity : 0),
      hasTypeInfo: existing.hasTypeInfo || hasTypeInfo,
    })
  }
  return Array.from(map.entries())
    .map(([platform, { revenue, quantity, downloads, streams, hasTypeInfo }]) => ({
      platform,
      revenue,
      quantity,
      ...(hasTypeInfo ? { downloadQuantity: downloads, streamQuantity: streams } : {}),
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

export function buildCountryBreakdown(transactions: SalesTransaction[]): CountryRevenue[] {
  const agg = aggregateBy(
    transactions
      .filter(t => t.country)
      .map(t => ({ key: t.country, revenue: t.net_revenue, quantity: t.quantity })),
  )
  return Array.from(agg.entries())
    .map(([country, { revenue, quantity }]) => ({ country, revenue, quantity }))
    .sort((a, b) => b.revenue - a.revenue)
}

function parseMonthToDate(month: string): number {
  if (!month || month === 'Unknown') return 0
  const d = new Date(month + '-01')
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

export function buildMonthlyBreakdown(transactions: SalesTransaction[]): MonthlyRevenue[] {
  const map = new Map<string, number>()
  for (const t of transactions) {
    if (!t.sales_month) continue
    map.set(t.sales_month, (map.get(t.sales_month) ?? 0) + t.net_revenue)
  }
  return Array.from(map.entries())
    .map(([month, revenue]) => ({ month, revenue }))
    .sort((a, b) => parseMonthToDate(a.month) - parseMonthToDate(b.month))
}

export function buildReleaseBreakdown(transactions: SalesTransaction[]): ReleaseRevenue[] {
  const map = new Map<string, ReleaseRevenue>()
  for (const t of transactions) {
    const key = (t.upc_ean || t.catalog_number || t.release_title || 'Unknown').toLowerCase()
    const existing = map.get(key)
    if (existing) {
      existing.revenue += t.net_revenue
      existing.quantity += t.quantity
    } else {
      map.set(key, {
        releaseTitle: t.release_title || '',
        upcEan: t.upc_ean || '',
        catalogNumber: t.catalog_number || '',
        revenue: t.net_revenue,
        quantity: t.quantity,
        isPhysical: t.is_physical,
      })
    }
  }

  const byTitle = new Map<string, ReleaseRevenue>()
  const untitled: ReleaseRevenue[] = []
  for (const entry of map.values()) {
    const titleKey = entry.releaseTitle.trim().toLowerCase()
    if (!titleKey) {
      untitled.push(entry)
      continue
    }
    const existing = byTitle.get(titleKey)
    if (existing) {
      existing.revenue += entry.revenue
      existing.quantity += entry.quantity
    } else {
      byTitle.set(titleKey, entry)
    }
  }
  return [...byTitle.values(), ...untitled].sort((a, b) => b.revenue - a.revenue)
}

/**
 * Builds a full artist → release → track hierarchy from processed data.
 */
export function buildArtistTree(artistData: ProcessedArtistData[]): ArtistTreeNode[] {
  return artistData.map(data => {
    const releaseMap = new Map<string, { meta: Omit<ReleaseWithTracks, 'tracks'>; trackMap: Map<string, TrackData> }>()

    for (const t of data.transactions) {
      const releaseKey = t.upc_ean || t.catalog_number || t.release_title || 'Unknown'
      let release = releaseMap.get(releaseKey)
      if (!release) {
        release = {
          meta: {
            releaseTitle: t.release_title || '',
            upcEan: t.upc_ean || '',
            catalogNumber: t.catalog_number || '',
            isPhysical: t.is_physical,
            revenue: 0,
            quantity: 0,
          },
          trackMap: new Map(),
        }
        releaseMap.set(releaseKey, release)
      }
      release.meta.revenue += t.net_revenue
      release.meta.quantity += t.quantity

      const trackKey = t.isrc || t.track_title || 'Unknown Track'
      const existingTrack = release.trackMap.get(trackKey)
      if (existingTrack) {
        existingTrack.revenue += t.net_revenue
        existingTrack.quantity += t.quantity
        if (t.platform && !existingTrack.platforms.includes(t.platform)) {
          existingTrack.platforms.push(t.platform)
        }
      } else {
        release.trackMap.set(trackKey, {
          trackTitle: t.track_title || 'Unknown Track',
          isrc: t.isrc || '',
          revenue: t.net_revenue,
          quantity: t.quantity,
          platforms: t.platform ? [t.platform] : [],
        })
      }
    }

    const releases: ReleaseWithTracks[] = Array.from(releaseMap.values())
      .map(({ meta, trackMap }) => ({
        ...meta,
        tracks: Array.from(trackMap.values()).sort((a, b) => b.revenue - a.revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue)

    return {
      artist: data.artist,
      totalRevenue: data.grossRevenue,
      finalPayout: data.finalPayout,
      splitPercentage: data.splitPercentage,
      quantity: data.totalQuantity,
      releases,
    }
  })
}