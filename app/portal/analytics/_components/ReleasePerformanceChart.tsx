'use client'

import { useTranslations } from 'next-intl'
import type { ReleasePerformanceRow } from '@/lib/analytics/releasePerformance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ReleasePerformanceChartProps {
  rows: ReleasePerformanceRow[]
}

function formatEur(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

export function ReleasePerformanceChart({ rows }: ReleasePerformanceChartProps) {
  const t = useTranslations('portal')

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground">{t('analytics_releases_noData')}</p>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t('analytics_releases_heading')}</h2>
      <p className="text-sm text-muted-foreground">{t('analytics_releases_hint')}</p>

      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t('analytics_releases_table_title')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto overflow-y-clip overscroll-x-contain" data-lenis-prevent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">{t('analytics_releases_col_release')}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t('analytics_releases_col_isrc')}</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">{t('analytics_releases_col_streams')}</th>
                  <th scope="col" className="px-4 py-3 font-medium text-right">{t('analytics_releases_col_revenue')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.releaseId ?? row.releaseTitle} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-medium">{row.releaseTitle}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {row.releaseIsrc ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.totalStreams.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-mono">
                      {formatEur(row.totalRevenueEur)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}