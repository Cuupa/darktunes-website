'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { CloudArrowUp } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { runPersistSosAnalytics } from '@/lib/sos/runPersistSosAnalytics'
import type { TerritoryMetricRow } from '@/lib/sos/data-processor'
import type { MerchOrderRow } from '@/lib/sos/merchOrderRows'
import type { ArtistRevenue, LabelArtist } from '@/lib/sos/types'
import { useDict } from '@/contexts/DictContext'
import { interpolate } from '@/lib/i18n/interpolate'

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

const PERSIST_FALLBACK = {
  persistTitle: 'Portal Analytics',
  persistDescription:
    'Persist territory metrics, merch orders, period summary, and correlations for linked artists ({metrics} metric rows, {merch} merch rows).',
  persistBronzeLinked: '{count} Bronze CSV archive(s) linked.',
  persistTerritoryHint:
    ' Territory metrics require processed CSV data with portal-linked artists.',
  persistSave: 'Save to Portal',
  persistSaving: 'Saving…',
  persistSuccess: 'Analytics saved: {metrics} metrics for {artists} artists{extras}',
  persistFailed: 'Failed to persist analytics',
} as const

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
  const dict = useDict()
  const t = { ...PERSIST_FALLBACK, ...dict.admin?.accounting }
  const [isPending, startTransition] = useTransition()

  const canPersist = territoryMetrics.length > 0
  const missingTerritoryHint =
    !canPersist && revenues.length > 0 ? t.persistTerritoryHint : ''

  const handlePersist = () => {
    if (!canPersist) return
    startTransition(async () => {
      const result = await runPersistSosAnalytics({
        periodStart,
        periodEnd,
        territoryMetrics,
        merchOrderRows,
        labelArtists,
        revenues,
        bronzeBatchIds,
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
          interpolate(t.persistSuccess, {
            metrics: result.metricsUpserted ?? 0,
            artists: result.artistsProcessed ?? 0,
            extras: `${impactNote}${merchNote}`,
          }),
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
        toast.error(result.error ?? t.persistFailed)
      }
    })
  }

  return (
    <div className="flex items-center justify-between gap-4 p-4 border border-border rounded-lg bg-card/50">
      <div>
        <p className="text-sm font-medium">{t.persistTitle}</p>
        <p className="text-xs text-muted-foreground">
          {interpolate(t.persistDescription, {
            metrics: territoryMetrics.length,
            merch: merchOrderRows.length,
          })}
          {bronzeBatchIds.length > 0 && (
            <> {interpolate(t.persistBronzeLinked, { count: bronzeBatchIds.length })}</>
          )}
          {missingTerritoryHint}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        onClick={handlePersist}
        disabled={disabled || isPending || !canPersist}
      >
        <CloudArrowUp size={16} className="mr-1.5" />
        {isPending ? t.persistSaving : t.persistSave}
      </Button>
    </div>
  )
}