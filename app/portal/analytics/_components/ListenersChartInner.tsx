'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ListenersChartInnerProps } from './ListenersChart'

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  fontSize: 12,
}

function fmtListeners(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

export function ListenersChartInner({
  dict,
  chartData,
  latestLastfm,
  latestSoundcharts,
}: ListenersChartInnerProps) {
  const hasLastfm = chartData.some((d) => d.lastfm > 0)
  const hasSoundcharts = chartData.some((d) => d.soundcharts > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{dict.analytics_listeners_heading}</h1>
        <p className="text-sm text-muted-foreground mt-1">{dict.analytics_listeners_hint}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {hasLastfm && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {dict.analytics_listeners_lastfm}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{fmtListeners(latestLastfm)}</p>
            </CardContent>
          </Card>
        )}
        {hasSoundcharts && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {dict.analytics_listeners_soundcharts}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{fmtListeners(latestSoundcharts)}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="bg-card border-border p-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={fmtListeners} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: number, name: string) => [fmtListeners(v), name]}
            />
            <Legend />
            {hasLastfm && (
              <Line
                type="monotone"
                dataKey="lastfm"
                name={dict.analytics_listeners_lastfm}
                stroke="oklch(0.65 0.28 295)"
                strokeWidth={2}
                dot={false}
              />
            )}
            {hasSoundcharts && (
              <Line
                type="monotone"
                dataKey="soundcharts"
                name={dict.analytics_listeners_soundcharts}
                stroke="oklch(0.60 0.25 300)"
                strokeWidth={2}
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}