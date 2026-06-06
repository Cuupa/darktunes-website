'use client'

/**
 * app/portal/analytics/_components/StreamingChartInner.tsx
 *
 * Contains all Recharts imports. Loaded lazily via dynamic() in StreamingChart.tsx
 * to avoid adding ~90 KB of Recharts to the initial bundle.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PLATFORM_COLORS, formatPlatformLabel } from './streamingChartUtils'
import type { StreamingChartInnerProps } from './StreamingChart'

export function StreamingChartInner({ dict, platforms, monthlyData, aggregates }: StreamingChartInnerProps) {
  const totalStreams = aggregates.reduce((sum, a) => sum + a.totalStreams, 0)

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{dict.analytics_heading}</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border col-span-2 md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-widest">
              {dict.analytics_totalStreams}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalStreams.toLocaleString()}</p>
          </CardContent>
        </Card>

        {aggregates.map((agg) => (
          <Card key={agg.platform} className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-widest">
                {formatPlatformLabel(agg.platform)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{agg.totalStreams.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly bar chart */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{dict.analytics_monthlyTrend}</CardTitle>
        </CardHeader>
        <CardContent>
          <div role="img" aria-label={dict.analytics_monthlyTrend}>
          <ResponsiveContainer
            width="100%"
            height={300}
          >
            <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#383838" />
              <XAxis dataKey="period" stroke="#666" tick={{ fill: '#999', fontSize: 12 }} />
              <YAxis stroke="#666" tick={{ fill: '#999', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#292929', border: '1px solid #383838' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend
                formatter={(value) => (
                  <span style={{ color: '#ccc', fontSize: 12 }}>
                    {formatPlatformLabel(value)}
                  </span>
                )}
              />
              {platforms.map((platform) => (
                <Bar
                  key={platform}
                  dataKey={platform}
                  fill={PLATFORM_COLORS[platform] ?? 'var(--primary)'}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
          </div>

          {/* Visually-hidden data table for screen readers */}
          <table className="sr-only">
            <caption>{dict.analytics_monthlyTrend}</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                {platforms.map((p) => (
                  <th key={p} scope="col">{formatPlatformLabel(p)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((row) => (
                <tr key={String(row.period)}>
                  <td>{row.period}</td>
                  {platforms.map((p) => (
                    <td key={p}>{row[p]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
