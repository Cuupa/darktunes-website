'use client'

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { RevenueMixSlice } from '@/lib/analytics/revenueMix'
import type { Dictionary } from '@/i18n/types'

const CATEGORY_COLORS: Record<RevenueMixSlice['category'], string> = {
  digital: 'hsl(var(--primary))',
  direct: 'hsl(142 76% 36%)',
  physical: 'hsl(38 92% 50%)',
  merch: 'hsl(0 72% 51%)',
}

export interface RevenueMixChartInnerProps {
  dict: Dictionary['portal']
  slices: RevenueMixSlice[]
  totalRevenue: number
}

function formatEur(value: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
}

const CATEGORY_LABEL_KEYS: Record<RevenueMixSlice['category'], keyof Dictionary['portal']> = {
  digital: 'analytics_revenue_mix_digital',
  direct: 'analytics_revenue_mix_direct',
  physical: 'analytics_revenue_mix_physical',
  merch: 'analytics_revenue_mix_merch',
}

export function RevenueMixChartInner({ dict, slices, totalRevenue }: RevenueMixChartInnerProps) {
  const chartData = slices.map((s) => ({
    name: dict[CATEGORY_LABEL_KEYS[s.category]],
    value: s.revenueEur,
    category: s.category,
    pct: totalRevenue > 0 ? Math.round((s.revenueEur / totalRevenue) * 1000) / 10 : 0,
  }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatEur(value)}
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: 12,
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="space-y-3 self-center">
        {chartData.map((entry) => (
          <li key={entry.category} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: CATEGORY_COLORS[entry.category] }}
                aria-hidden="true"
              />
              {entry.name}
            </span>
            <span className="tabular-nums font-mono text-muted-foreground">
              {formatEur(entry.value)} ({entry.pct}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}