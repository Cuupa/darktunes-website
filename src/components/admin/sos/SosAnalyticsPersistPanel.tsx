'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { CloudArrowUp } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { persistSosAnalytics } from '@/lib/sos/persistSosAnalyticsAction'
import type { TerritoryMetricRow } from '@/lib/sos/data-processor'
import type { MerchOrderRow } from '@/lib/sos/merchOrderRows'
import type { ArtistRevenue, LabelArtist } from '@/lib/sos/types'

interface SosAnalyticsPersistPanelProps {
  periodStart: string
  periodEnd: string
  territoryMetrics: TerritoryMetricRow[]
  merchOrderRows?: MerchOrderRow[]
  labelArtists: LabelArtist[]
  revenues?: ArtistRevenue[]
  bronzeBatchIds?: string[]
  disabled?: boolean
}

export function SosAnalyticsPersistPanel({
  periodStart,
  periodEnd,
  territoryMetrics,
  merchOrderRows = [],
  labelArtists,
  revenues = [],
  bronzeBatchIds = [],
  disabled = false,
}: SosAnalyticsPersistPanelProps) {
  const [isPending, startTransition] = useTransition()

  const handlePersist = () => {
    startTransition(async () => {
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

      const result = await persistSosAnalytics({
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

      if (result.success) {
        const impactNote =
          result.eventImpactRows != null && result.eventImpactRows > 0
            ? ` · ${result.eventImpactRows} event-impact rows`
            : ''
        const merchNote =
          result.merchOrdersUpserted != null && result.merchOrdersUpserted > 0
            ? ` · ${result.merchOrdersUpserted} merch orders`
            : ''
        toast.success(
          `Analytics saved: ${result.metricsUpserted ?? 0} metrics for ${result.artistsProcessed ?? 0} artists${impactNote}${merchNote}`,
        )
        if (result.eventImpactWarnings?.length) {
          toast.warning('Event impact partially failed', {
            description: result.eventImpactWarnings.join('; '),
          })
        }
        if (result.promoImpactWarnings?.length) {
          toast.warning('Promo impact partially failed', {
            description: result.promoImpactWarnings.join('; '),
          })
        }
      } else {
        toast.error(result.error ?? 'Failed to persist analytics')
      }
    })
  }

  return (
    <div className="flex items-center justify-between gap-4 p-4 border border-border rounded-lg bg-card/50">
      <div>
        <p className="text-sm font-medium">Portal Analytics</p>
        <p className="text-xs text-muted-foreground">
          Persist territory metrics, merch orders, period summary, and correlations for linked artists ({territoryMetrics.length} metric rows, {merchOrderRows.length} merch rows).
          {bronzeBatchIds.length > 0 && (
            <> {bronzeBatchIds.length} Bronze CSV archive{bronzeBatchIds.length === 1 ? '' : 's'} linked.</>
          )}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        onClick={handlePersist}
        disabled={disabled || isPending || territoryMetrics.length === 0}
      >
        <CloudArrowUp size={16} className="mr-1.5" />
        {isPending ? 'Saving…' : 'Save to Portal'}
      </Button>
    </div>
  )
}