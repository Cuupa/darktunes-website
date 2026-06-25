'use client'

import { useMemo } from 'react'
import { ChartPie, MusicNote, Storefront, TShirt } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import type { ArtistRevenue } from '@/lib/sos/types'
import { useAccountingMessages } from '@/lib/i18n/accountingFallbacks'

interface SourceMixPanelProps {
  revenues: ArtistRevenue[]
  periodStart?: string
  periodEnd?: string
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
}

export function SourceMixPanel({ revenues, periodStart, periodEnd }: SourceMixPanelProps) {
  const accounting = useAccountingMessages()
  const sourceMixSubtitle =
    accounting?.sourceMixSubtitle ??
    'SOS session — distributor view (in-memory CSV data)'

  const totals = useMemo(() => {
    let believe = 0
    let bandcamp = 0
    let darkmerch = 0
    let streams = 0
    let downloads = 0
    let physical = 0
    let manual = 0

    for (const r of revenues) {
      believe += r.believeRevenue
      bandcamp += r.bandcampRevenue
      darkmerch += r.darkmerchRevenue
      manual += r.manualRevenue
      streams += r.totalStreamRevenue
      downloads += r.totalDownloadRevenue
      physical += r.physicalReleasesRevenue
    }

    return { believe, bandcamp, darkmerch, manual, streams, downloads, physical, total: believe + bandcamp + darkmerch + manual }
  }, [revenues])

  if (revenues.length === 0) return null

  return (
    <Card className="p-4 space-y-3 border-border bg-card/50">
      <div className="flex items-center gap-2">
        <ChartPie size={18} className="text-primary" />
        <div>
          <p className="text-sm font-medium">Revenue by Source</p>
          <p className="text-[11px] text-muted-foreground">{sourceMixSubtitle}</p>
        </div>
        {(periodStart || periodEnd) && (
          <span className="text-xs text-muted-foreground ml-auto">
            {periodStart}{periodEnd && periodEnd !== periodStart ? ` – ${periodEnd}` : ''}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <MusicNote size={16} className="text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Believe (DSP)</p>
            <p className="font-semibold tabular-nums">{fmtEur(totals.believe)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Storefront size={16} className="text-cyan-400" />
          <div>
            <p className="text-xs text-muted-foreground">Bandcamp</p>
            <p className="font-semibold tabular-nums">{fmtEur(totals.bandcamp)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TShirt size={16} className="text-orange-400" />
          <div>
            <p className="text-xs text-muted-foreground">Merch (Darkmerch)</p>
            <p className="font-semibold tabular-nums">{fmtEur(totals.darkmerch)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground border-t border-border pt-3">
        <span>Streams: {fmtEur(totals.streams)}</span>
        <span>Downloads: {fmtEur(totals.downloads)}</span>
        <span>Physical: {fmtEur(totals.physical)}</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Save analytics to the portal to correlate streams, territories, and events (concerts, promos) in Artist Analytics.
      </p>
    </Card>
  )
}