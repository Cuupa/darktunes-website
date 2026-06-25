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

export interface EarningsChartInnerProps {
  chartData: { period: string; amount: number }[]
  totalEarned: number
  lastPayout: number | undefined
  pendingCount: number
}

interface EarningsChartProps {
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

export function EarningsChart({ statements }: EarningsChartProps) {
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

    const settledStatuses = new Set(['invoiced', 'acknowledged', 'paid'] as const)
    const lastPayoutStatement = statements
      .filter((s) => settledStatuses.has(s.status as 'invoiced' | 'acknowledged' | 'paid') && s.amountEur !== undefined)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const last = lastPayoutStatement[0]?.amountEur

    const pendingStatuses = new Set(['label_approved', 'artist_notified', 'viewed'] as const)
    const pending = statements.filter((s) => pendingStatuses.has(s.status as 'label_approved' | 'artist_notified' | 'viewed')).length

    return { chartData: data, totalEarned: total, lastPayout: last, pendingCount: pending }
  }, [statements])

  return (
    <EarningsChartInner
      chartData={chartData}
      totalEarned={totalEarned}
      lastPayout={lastPayout}
      pendingCount={pendingCount}
    />
  )
}
