'use client'

/**
 * app/portal/analytics/_components/EarningsChart.tsx
 *
 * Lazy-loads EarningsChartInner (Recharts) so it does not bloat the
 * initial bundle. Receives all data as props (IoC — never fetches).
 */

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import type { SalesStatement } from '@/lib/api/salesStatements'
import type { Dictionary } from '@/i18n/types'

export interface EarningsChartInnerProps {
  dict: Dictionary['portal']
  chartData: { period: string; amount: number }[]
  totalEarned: number
  lastPayout: number | undefined
  pendingCount: number
}

interface EarningsChartProps {
  dict: Dictionary['portal']
  statements: SalesStatement[]
}

const EarningsChartInner = dynamic(
  () => import('./EarningsChartInner').then((m) => m.EarningsChartInner),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    ),
  },
)

export function EarningsChart({ dict, statements }: EarningsChartProps) {
  const { chartData, totalEarned, lastPayout, pendingCount } = useMemo(() => {
    // Build chart data: one bar per unique period, sum amounts
    const periodMap = new Map<string, number>()
    for (const s of statements) {
      if (s.amountEur !== undefined) {
        periodMap.set(s.period, (periodMap.get(s.period) ?? 0) + s.amountEur)
      }
    }

    const data = [...periodMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, amount]) => ({ period, amount }))

    const total = [...periodMap.values()].reduce((sum, v) => sum + v, 0)

    // Last payout = most recent acknowledged/approved statement amount
    const acknowledged = statements
      .filter((s) => (s.status === 'acknowledged' || s.status === 'label_approved') && s.amountEur !== undefined)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const last = acknowledged[0]?.amountEur

    const pending = statements.filter((s) => s.status === 'label_approved').length

    return { chartData: data, totalEarned: total, lastPayout: last, pendingCount: pending }
  }, [statements])

  return (
    <EarningsChartInner
      dict={dict}
      chartData={chartData}
      totalEarned={totalEarned}
      lastPayout={lastPayout}
      pendingCount={pendingCount}
    />
  )
}
