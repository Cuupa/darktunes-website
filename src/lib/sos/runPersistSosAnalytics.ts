import { persistSosAnalytics } from '@/lib/sos/persistSosAnalyticsAction'
import type { PersistSosAnalyticsResult } from '@/lib/sos/persistSosAnalyticsAction'
import type { TerritoryMetricRow } from '@/lib/sos/data-processor'
import type { MerchOrderRow } from '@/lib/sos/merchOrderRows'
import type { ArtistRevenue, LabelArtist } from '@/lib/sos/types'

export interface RunPersistSosAnalyticsParams {
  periodStart: string
  periodEnd: string
  territoryMetrics: TerritoryMetricRow[]
  merchOrderRows?: MerchOrderRow[]
  labelArtists: LabelArtist[]
  revenues?: ArtistRevenue[]
  bronzeBatchIds?: string[]
}

export async function runPersistSosAnalytics(
  params: RunPersistSosAnalyticsParams,
): Promise<PersistSosAnalyticsResult> {
  const {
    periodStart,
    periodEnd,
    territoryMetrics,
    merchOrderRows = [],
    labelArtists,
    revenues = [],
    bronzeBatchIds = [],
  } = params

  const periodSummary =
    revenues.length > 0 && periodStart
      ? {
          periodStart,
          periodEnd: periodEnd || periodStart,
          totalRevenue: revenues.reduce((s, r) => s + r.totalRevenue, 0),
          totalPayout: revenues.reduce((s, r) => s + r.finalAmount, 0),
          artistCount: revenues.length,
          artistBreakdowns: revenues.map((r) => ({
            artist: r.artist,
            revenue: r.totalRevenue,
            payout: r.finalAmount,
          })),
          platformBreakdowns: revenues.flatMap((r) => r.platformBreakdown),
          sourceBatchIds: bronzeBatchIds,
        }
      : undefined

  return persistSosAnalytics({
    periodStart,
    periodEnd,
    batchIds: bronzeBatchIds,
    territoryMetrics,
    merchOrderRows,
    labelArtists: labelArtists.map((la) => ({
      name: la.name,
      artistId: la.artistId,
    })),
    periodSummary,
  })
}