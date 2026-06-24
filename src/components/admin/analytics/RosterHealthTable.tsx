'use client'

import type { RosterHealthRow } from '@/lib/api/labelAnalytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface RosterHealthTableProps {
  rows: RosterHealthRow[]
}

function formatEur(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

function formatGrowth(pct: number | null): string {
  if (pct === null) return '—'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct}%`
}

export function RosterHealthTable({ rows }: RosterHealthTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No roster analytics yet. Persist SOS data from Accounting → Analytics.
      </p>
    )
  }

  return (
    <Card className="bg-card border-border overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Roster health matrix</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">Artist</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Total streams</th>
                <th scope="col" className="px-4 py-3 font-medium">Latest period</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">MoM growth</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Revenue</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Open statements</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.artistId} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-medium">{row.artistName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.totalStreams.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.latestPeriod ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span
                      className={
                        row.streamGrowthPct !== null && row.streamGrowthPct >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : row.streamGrowthPct !== null
                            ? 'text-red-600 dark:text-red-400'
                            : ''
                      }
                    >
                      {formatGrowth(row.streamGrowthPct)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono">
                    {formatEur(row.totalRevenueEur)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.openStatements > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {row.openStatements}
                      </span>
                    ) : (
                      '0'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}