'use client'

import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import type { RevenueMixSlice } from '@/lib/analytics/revenueMix'
import { totalRevenueFromMix } from '@/lib/analytics/revenueMix'
import { Skeleton } from '@/components/ui/skeleton'

const RevenueMixChartInner = dynamic(
  () => import('./RevenueMixChartInner').then((m) => m.RevenueMixChartInner),
  {
    ssr: false,
    loading: () => <Skeleton className="h-72 w-full rounded-xl" />,
  },
)

interface RevenueMixChartProps {
  slices: RevenueMixSlice[]
}

export function RevenueMixChart({ slices }: RevenueMixChartProps) {
  const t = useTranslations('portal')

  const totalRevenue = totalRevenueFromMix(slices)

  if (slices.length === 0 || totalRevenue === 0) {
    return (
      <p className="text-muted-foreground">{t('analytics_revenue_mix_noData')}</p>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{t('analytics_revenue_mix_heading')}</h2>
      <p className="text-sm text-muted-foreground">{t('analytics_revenue_mix_hint')}</p>
      <RevenueMixChartInner slices={slices} totalRevenue={totalRevenue} />
    </div>
  )
}