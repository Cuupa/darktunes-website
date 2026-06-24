'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AnalyticsStatCardProps {
  label: string
  value: string | number
  icon?: React.ElementType
}

export function AnalyticsStatCard({ label, value, icon: Icon }: AnalyticsStatCardProps) {
  const display =
    typeof value === 'number' ? value.toLocaleString() : value

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-1">
          {Icon ? <Icon size={12} aria-hidden="true" /> : null}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums">{display}</p>
      </CardContent>
    </Card>
  )
}