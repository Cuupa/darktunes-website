'use client'

import { useTranslations } from 'next-intl'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TerritoriesChartInnerProps } from './TerritoriesChart'

export function TerritoriesChartInner({ countries }: TerritoriesChartInnerProps) {
  const t = useTranslations('portal')

  const topCountries = countries.slice(0, 15)

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>{t('analytics_territories_heading')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div role="img" aria-label={t('analytics_territories_heading')}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={topCountries}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#383838" />
              <XAxis type="number" stroke="#666" tick={{ fill: '#999', fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="country"
                stroke="#666"
                tick={{ fill: '#999', fontSize: 11 }}
                width={75}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#292929', border: '1px solid #383838' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="totalStreams" fill="var(--primary)" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}