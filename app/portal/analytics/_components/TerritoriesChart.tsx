'use client'

import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import type { CountryAggregate } from '@/lib/api/artistTerritoryMetrics'
import { Skeleton } from '@/components/ui/skeleton'

export interface TerritoriesChartInnerProps {
  countries: CountryAggregate[]
}

const TerritoriesChartInner = dynamic(
  () => import('./TerritoriesChartInner').then((m) => m.TerritoriesChartInner),
  {
    ssr: false,
    loading: () => <Skeleton className="h-80 w-full rounded-xl" />,
  },
)

interface TerritoriesChartProps {
  countries: CountryAggregate[]
}

export function TerritoriesChart({ countries }: TerritoriesChartProps) {
  const t = useTranslations('portal')

  if (countries.length === 0) {
    return (
      <p className="text-muted-foreground">{t('analytics_territories_noData')}</p>
    )
  }

  return <TerritoriesChartInner countries={countries} />
}