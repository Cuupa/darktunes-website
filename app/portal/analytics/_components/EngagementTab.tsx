'use client'

import { useTranslations } from 'next-intl'
import { ChartLine, CursorClick, Eye } from '@phosphor-icons/react'
import type { PageEngagementStats } from '@/lib/api/pageEvents'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AnalyticsStatCard } from './AnalyticsStatCard'

interface EngagementTabProps {
  stats: PageEngagementStats
}

export function EngagementTab({ stats }: EngagementTabProps) {
  const t = useTranslations('portal')

  const hasData =
    stats.totalViews > 0 || stats.shopClicks > 0 || stats.newsViews > 0

  if (!hasData) {
    return (
      <p className="text-muted-foreground">{t('analytics_engagement_noData')}</p>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">{t('analytics_engagement_heading')}</h2>
        <p className="text-sm text-muted-foreground">{t('analytics_engagement_hint')}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <AnalyticsStatCard label={t('analytics_engagement_total_views')} value={stats.totalViews} icon={Eye} />
        <AnalyticsStatCard label={t('analytics_engagement_last30_views')} value={stats.last30DaysViews} icon={ChartLine} />
        <AnalyticsStatCard label={t('analytics_engagement_shop_clicks')} value={stats.shopClicks} icon={CursorClick} />
        <AnalyticsStatCard label={t('analytics_engagement_last30_shop')} value={stats.last30DaysShopClicks} icon={CursorClick} />
      </div>

      {stats.dailyViews.length > 0 && (
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('analytics_engagement_daily_title')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th scope="col" className="px-4 py-3 font-medium">{t('analytics_engagement_col_date')}</th>
                    <th scope="col" className="px-4 py-3 font-medium text-right">{t('analytics_engagement_col_views')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.dailyViews.map((row) => (
                    <tr key={row.date} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs">{row.date}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}