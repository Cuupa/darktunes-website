'use client'

import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { ArtistListenerMetric } from '@/lib/api/artistListenerMetrics'
import { Skeleton } from '@/components/ui/skeleton'

export interface ListenersChartInnerProps {
  chartData: Array<{ period: string; lastfm: number; soundcharts: number }>
  latestLastfm: number
  latestSoundcharts: number
}

interface ListenersChartProps {
  metrics: ArtistListenerMetric[]
}

const ListenersChartInner = dynamic(
  () => import('./ListenersChartInner').then((m) => m.ListenersChartInner),
  {
    ssr: false,
    loading: () => <Skeleton className="h-80 w-full rounded-xl" />,
  },
)

export function ListenersChart({ metrics }: ListenersChartProps) {
  const t = useTranslations('portal')

  const { chartData, latestLastfm, latestSoundcharts } = useMemo(() => {
    const periods = new Set<string>()
    const lastfmByPeriod = new Map<string, number>()
    const soundchartsByPeriod = new Map<string, number>()

    for (const m of metrics) {
      if (m.metricType !== 'listeners') continue
      periods.add(m.period)
      if (m.source === 'lastfm') lastfmByPeriod.set(m.period, m.value)
      if (m.source === 'soundcharts') soundchartsByPeriod.set(m.period, m.value)
    }

    const sortedPeriods = Array.from(periods).sort()
    const data = sortedPeriods.map((period) => ({
      period,
      lastfm: lastfmByPeriod.get(period) ?? 0,
      soundcharts: soundchartsByPeriod.get(period) ?? 0,
    }))

    const lastPeriod = sortedPeriods.at(-1)
    return {
      chartData: data,
      latestLastfm: lastPeriod ? (lastfmByPeriod.get(lastPeriod) ?? 0) : 0,
      latestSoundcharts: lastPeriod ? (soundchartsByPeriod.get(lastPeriod) ?? 0) : 0,
    }
  }, [metrics])

  if (metrics.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{t('analytics_listeners_heading')}</h2>
        <p className="text-muted-foreground">{t('analytics_listeners_noData')}</p>
      </div>
    )
  }

  return (
    <ListenersChartInner
      chartData={chartData}
      latestLastfm={latestLastfm}
      latestSoundcharts={latestSoundcharts}
    />
  )
}