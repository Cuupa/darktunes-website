import { persistSosAnalytics } from '@/lib/sos/persistSosAnalyticsAction'
import type { TerritoryMetricRow } from '@/lib/sos/data-processor'
import type { ArtistRevenue, LabelArtist } from '@/lib/sos/types'

export interface PersistAfterUploadContext {
  artistName: string
  periodStart: string
  periodEnd: string
  territoryMetrics: TerritoryMetricRow[]
  labelArtists: LabelArtist[]
  revenues: ArtistRevenue[]
  bronzeBatchIds: string[]
  batchId?: string
}

/**
 * Fire-and-forget gold-layer persist after a statement is uploaded to the portal.
 * Filters territory metrics to the published artist only.
 */
export async function persistAnalyticsAfterStatementUpload(
  ctx: PersistAfterUploadContext,
): Promise<void> {
  const artistMetrics = ctx.territoryMetrics.filter(
    (m) => m.artistName.trim().toLowerCase() === ctx.artistName.trim().toLowerCase(),
  )
  if (artistMetrics.length === 0) return

  const artistRevenue = ctx.revenues.find(
    (r) => r.artist.trim().toLowerCase() === ctx.artistName.trim().toLowerCase(),
  )

  const batchIds = [
    ...new Set([
      ...ctx.bronzeBatchIds,
      ...(ctx.batchId ? [ctx.batchId] : []),
    ]),
  ]

  const result = await persistSosAnalytics({
    periodStart: ctx.periodStart,
    periodEnd: ctx.periodEnd,
    batchIds,
    territoryMetrics: artistMetrics,
    labelArtists: ctx.labelArtists.map((la) => ({
      name: la.name,
      artistId: la.artistId,
    })),
    periodSummary: artistRevenue
      ? {
          periodStart: ctx.periodStart,
          periodEnd: ctx.periodEnd || ctx.periodStart,
          totalRevenue: artistRevenue.totalRevenue,
          totalPayout: artistRevenue.finalAmount,
          artistCount: 1,
          artistBreakdowns: [{
            artist: artistRevenue.artist,
            revenue: artistRevenue.totalRevenue,
            payout: artistRevenue.finalAmount,
          }],
          platformBreakdowns: artistRevenue.platformBreakdown,
          sourceBatchIds: batchIds,
        }
      : undefined,
  })

  if (!result.success) {
    console.warn('[persistAnalyticsAfterStatementUpload]', result.error)
  }
}