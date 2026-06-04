'use client'

/**
 * app/portal/analytics/_components/StreamingChart.tsx — Client Component (leaf)
 *
 * Visualises streaming stats using Recharts BarChart.
 * Receives all data as props (IoC) — never fetches data directly.
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
import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { StreamingStat, PlatformAggregate } from '@/lib/api/streamingStats'
import type { Dictionary } from '@/i18n/types'

interface StreamingChartProps {
  dict: Dictionary['portal']
  stats: StreamingStat[]
  aggregates: PlatformAggregate[]
}

const PLATFORM_COLORS: Record<string, string> = {
  spotify: '#1db954',
  apple_music: '#fc3c44',
  youtube: '#ff0000',
  other: '#493687',
}

function formatPlatformLabel(platform: string): string {
  return platform
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function StreamingChart({ dict, stats, aggregates }: StreamingChartProps) {
  // Build monthly trend data: { period, spotify, apple_music, ... }
  // useMemo must be called before any early returns (Rules of Hooks).
  const { platforms, monthlyData } = useMemo(() => {
    const _periods = [...new Set(stats.map((s) => s.period))].sort()
    const _platforms = [...new Set(stats.map((s) => s.platform))]
    // Pre-index stats by "period|platform" for O(1) lookup
    const statsIndex = new Map<string, number>()
    for (const s of stats) {
      statsIndex.set(`${s.period}|${s.platform}`, s.streams)
    }
    const _monthlyData = _periods.map((period) => {
      const row: Record<string, string | number> = { period }
      for (const platform of _platforms) {
        row[platform] = statsIndex.get(`${period}|${platform}`) ?? 0
      }
      return row
    })
    return { platforms: _platforms, monthlyData: _monthlyData }
  }, [stats])

  if (stats.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">{dict.analytics_heading}</h1>
        <p className="text-muted-foreground">{dict.analytics_noData}</p>
      </div>
    )
  }

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
          <ResponsiveContainer width="100%" height={300}>
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
                  fill={PLATFORM_COLORS[platform] ?? '#493687'}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
