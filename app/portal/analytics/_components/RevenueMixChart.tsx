'use client'

import dynamic from 'next/dynamic'
import type { RevenueMixSlice } from '@/lib/analytics/revenueMix'
import { totalRevenueFromMix } from '@/lib/analytics/revenueMix'
import type { Dictionary } from '@/i18n/types'
import { Skeleton } from '@/components/ui/skeleton'

const RevenueMixChartInner = dynamic(
  () => import('./RevenueMixChartInner').then((m) => m.RevenueMixChartInner),
  {
    ssr: false,
    loading: () => <Skeleton className="h-72 w-full rounded-xl" />,
  },
)

interface RevenueMixChartProps {
  dict: Dictionary['portal']
  slices: RevenueMixSlice[]
}

export function RevenueMixChart({ dict, slices }: RevenueMixChartProps) {
  const totalRevenue = totalRevenueFromMix(slices)

  if (slices.length === 0 || totalRevenue === 0) {
    return (
      <p className="text-muted-foreground">{dict.analytics_revenue_mix_noData}</p>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{dict.analytics_revenue_mix_heading}</h2>
      <p className="text-sm text-muted-foreground">{dict.analytics_revenue_mix_hint}</p>
      <RevenueMixChartInner dict={dict} slices={slices} totalRevenue={totalRevenue} />
    </div>
  )
}