'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface TrendChartPoint {
  period: string
  revenue: number
  payout: number
}

interface TrendsChartInnerProps {
  data: TrendChartPoint[]
}

function formatEur(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  fontSize: 12,
}

export function TrendsChartInner({ data }: TrendsChartInnerProps) {
  return (
    <div className="h-72 w-full rounded-xl border border-border bg-card p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}k`}
            className="text-muted-foreground"
          />
          <Tooltip
            formatter={(value) => formatEur(Number(value ?? 0))}
            contentStyle={TOOLTIP_STYLE}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary) / 0.15)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="payout"
            name="Payout"
            stroke="hsl(142 76% 36%)"
            fill="hsl(142 76% 36% / 0.1)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}