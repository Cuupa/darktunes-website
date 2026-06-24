'use client'

import dynamic from 'next/dynamic'
import type { CountryAggregate } from '@/lib/api/artistTerritoryMetrics'
import type { Dictionary } from '@/i18n/types'
import { Skeleton } from '@/components/ui/skeleton'

export interface TerritoriesChartInnerProps {
  dict: Dictionary['portal']
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
  dict: Dictionary['portal']
  countries: CountryAggregate[]
}

export function TerritoriesChart({ dict, countries }: TerritoriesChartProps) {
  if (countries.length === 0) {
    return (
      <p className="text-muted-foreground">{dict.analytics_territories_noData}</p>
    )
  }

  return <TerritoriesChartInner dict={dict} countries={countries} />
}