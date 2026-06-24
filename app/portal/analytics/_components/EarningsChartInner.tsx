'use client'

/**
 * app/portal/analytics/_components/EarningsChartInner.tsx
 *
 * Contains all Recharts imports. Loaded lazily via dynamic() in EarningsChart.tsx
 * to avoid adding Recharts to the initial bundle.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyEur, ClockCounterClockwise, Hourglass } from '@phosphor-icons/react'
import type { EarningsChartInnerProps } from './EarningsChart'

function formatEur(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

export function EarningsChartInner({ dict, chartData, totalEarned, lastPayout, pendingCount }: EarningsChartInnerProps) {
  const hasData = chartData.length > 0

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">{dict.analytics_earnings_heading}</h2>

      {/* KPI summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <CurrencyEur size={12} aria-hidden="true" />
              {dict.analytics_earnings_total}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold font-mono">{formatEur(totalEarned)}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <ClockCounterClockwise size={12} aria-hidden="true" />
              {dict.analytics_earnings_last_payout}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold font-mono">
              {lastPayout !== undefined ? formatEur(lastPayout) : '—'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
              <Hourglass size={12} aria-hidden="true" />
              {dict.analytics_earnings_pending}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{pendingCount}</p>
          </CardContent>
        </Card>
      </div>

      {hasData ? (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>{dict.analytics_earnings_chart_label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div role="img" aria-label={dict.analytics_earnings_chart_label}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#383838" />
                  <XAxis
                    dataKey="period"
                    stroke="#666"
                    tick={{ fill: '#999', fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#666"
                    tick={{ fill: '#999', fontSize: 12 }}
                    tickFormatter={(v: number) => `${v} €`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#292929', border: '1px solid #383838' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value: number) => [formatEur(value), dict.analytics_earnings_chart_label]}
                  />
                  <Bar
                    dataKey="amount"
                    fill="var(--primary)"
                    radius={[2, 2, 0, 0]}
                    name={dict.analytics_earnings_chart_label}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Visually-hidden data table for screen readers */}
            <table className="sr-only">
              <caption>{dict.analytics_earnings_chart_label}</caption>
              <thead>
                <tr>
                  <th scope="col">{dict.statements_period}</th>
                  <th scope="col">{dict.statements_amount}</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row) => (
                  <tr key={row.period}>
                    <td>{row.period}</td>
                    <td>{formatEur(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center text-muted-foreground">
            <CurrencyEur size={40} className="mx-auto mb-4 opacity-30" aria-hidden="true" />
            <p>{dict.analytics_earnings_noData}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
