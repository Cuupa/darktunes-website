/**
 * Admin press engagement aggregation from journalist_downloads.
 */

import type { JournalistDownload } from '@/types'

export interface PressEngagementSummary {
  totalDownloads: number
  last30Days: number
  uniqueJournalists: number
  downloadsByMonth: { month: string; count: number }[]
  topAssetKeys: { assetKey: string; count: number }[]
}

export function aggregatePressEngagement(downloads: JournalistDownload[]): PressEngagementSummary {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString()
  const byMonth = new Map<string, number>()
  const byAsset = new Map<string, number>()
  const journalists = new Set<string>()

  for (const d of downloads) {
    journalists.add(d.journalistId)
    const month = d.downloadedAt.slice(0, 7)
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1)
    byAsset.set(d.assetKey, (byAsset.get(d.assetKey) ?? 0) + 1)
  }

  const last30Days = downloads.filter((d) => d.downloadedAt >= thirtyDaysAgo).length

  return {
    totalDownloads: downloads.length,
    last30Days,
    uniqueJournalists: journalists.size,
    downloadsByMonth: [...byMonth.entries()]
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    topAssetKeys: [...byAsset.entries()]
      .map(([assetKey, count]) => ({ assetKey, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  }
}