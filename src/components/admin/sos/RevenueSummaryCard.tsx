'use client'

/**
 * src/components/admin/sos/RevenueSummaryCard.tsx
 *
 * Single KPI stat card for the analytics dashboard.
 */

import { Card } from '@/components/ui/card'

interface RevenueSummaryCardProps {
  label: string
  value: string
  sub?: string
  icon?: React.ReactNode
}

export function RevenueSummaryCard({ label, value, sub, icon }: RevenueSummaryCardProps) {
  return (
    <Card className="p-4 flex items-start gap-3">
      {icon && (
        <div className="mt-0.5 text-primary">{icon}</div>
      )}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">{label}</p>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </Card>
  )
}
