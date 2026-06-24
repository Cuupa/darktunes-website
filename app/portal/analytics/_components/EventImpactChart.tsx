'use client'

import type { EventImpact } from '@/lib/api/eventImpact'
import type { Concert } from '@/types'
import type { Dictionary } from '@/i18n/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface EventImpactChartProps {
  dict: Dictionary['portal']
  impacts: EventImpact[]
  concerts: Concert[]
}

export function EventImpactChart({ dict, impacts, concerts }: EventImpactChartProps) {
  if (impacts.length === 0) {
    return (
      <p className="text-muted-foreground">{dict.analytics_eventImpact_noData}</p>
    )
  }

  const concertMap = new Map(concerts.map((c) => [c.id, c]))
  const sorted = [...impacts]
    .filter((i) => i.deltaStreams !== 0 || i.deltaPct !== 0)
    .sort((a, b) => b.deltaPct - a.deltaPct)
    .slice(0, 20)

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>{dict.analytics_eventImpact_heading}</CardTitle>
        <p className="text-sm text-muted-foreground">{dict.analytics_eventImpact_hint}</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2 pr-4" scope="col">{dict.analytics_eventImpact_event}</th>
                <th className="py-2 pr-4" scope="col">{dict.analytics_eventImpact_country}</th>
                <th className="py-2 pr-4 text-right" scope="col">{dict.analytics_eventImpact_delta}</th>
                <th className="py-2 text-right" scope="col">{dict.analytics_eventImpact_pct}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const concert = concertMap.get(row.concertId)
                const label = concert
                  ? `${concert.eventName} — ${concert.venueCity ?? ''} (${concert.concertDate})`
                  : row.concertId
                const deltaSign = row.deltaPct >= 0 ? '+' : ''
                return (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="py-2 pr-4">{label}</td>
                    <td className="py-2 pr-4">{row.country}</td>
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