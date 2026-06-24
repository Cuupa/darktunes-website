'use client'

import type { PromoImpact } from '@/lib/api/promoImpact'
import type { PromoLogEntry } from '@/types'
import type { Dictionary } from '@/i18n/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PromoImpactChartProps {
  dict: Dictionary['portal']
  impacts: PromoImpact[]
  promoEntries: PromoLogEntry[]
}

export function PromoImpactChart({ dict, impacts, promoEntries }: PromoImpactChartProps) {
  if (impacts.length === 0) {
    return null
  }

  const promoMap = new Map(promoEntries.map((p) => [p.id, p]))
  const sorted = [...impacts]
    .filter((i) => i.deltaStreams !== 0 || i.deltaPct !== 0)
    .sort((a, b) => b.deltaPct - a.deltaPct)
    .slice(0, 15)

  if (sorted.length === 0) return null

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>{dict.analytics_promoImpact_heading}</CardTitle>
        <p className="text-sm text-muted-foreground">{dict.analytics_promoImpact_hint}</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4" scope="col">{dict.analytics_promoImpact_action}</th>
                <th className="py-2 pr-4" scope="col">{dict.analytics_promoImpact_date}</th>
                <th className="py-2 pr-4 text-right" scope="col">{dict.analytics_eventImpact_delta}</th>
                <th className="py-2 text-right" scope="col">{dict.analytics_eventImpact_pct}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const promo = promoMap.get(row.promoLogId)
                const label = promo?.description ?? row.promoLogId
                const deltaSign = row.deltaPct >= 0 ? '+' : ''
                return (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="py-2 pr-4 max-w-xs truncate">{label}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{promo?.actionDate ?? '—'}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {row.deltaStreams >= 0 ? '+' : ''}{row.deltaStreams.toLocaleString()}
                    </td>
                    <td className={`py-2 text-right tabular-nums ${row.deltaPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {deltaSign}{row.deltaPct.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}