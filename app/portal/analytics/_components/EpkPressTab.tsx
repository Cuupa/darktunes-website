'use client'

import { useTranslations } from 'next-intl'
import { ChartBar, DownloadSimple, Newspaper } from '@phosphor-icons/react'
import type { EpkDownloadStats } from '@/lib/api/epkDownloadEvents'
import type { ArtistPressDownloadStats } from '@/lib/api/journalistDownloads'
import { AnalyticsStatCard } from './AnalyticsStatCard'

interface EpkPressTabProps {
  epkStats: EpkDownloadStats
  pressStats: ArtistPressDownloadStats
}

export function EpkPressTab({ epkStats, pressStats }: EpkPressTabProps) {
  const t = useTranslations('portal')

  const hasData =
    epkStats.total > 0 || pressStats.totalDownloads > 0

  if (!hasData) {
    return (
      <p className="text-muted-foreground">{t('analytics_press_noData')}</p>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">{t('analytics_press_heading')}</h2>
        <p className="text-sm text-muted-foreground">{t('analytics_press_hint')}</p>
      </div>

      <section aria-labelledby="epk-downloads-heading">
        <h3 id="epk-downloads-heading" className="text-lg font-semibold mb-3 flex items-center gap-2">
          <ChartBar size={18} aria-hidden="true" />
          {t('analytics_press_epk_section')}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <AnalyticsStatCard label={t('epk_analytics_total')} value={epkStats.total} icon={DownloadSimple} />
          <AnalyticsStatCard label={t('epk_analytics_last_30')} value={epkStats.last30Days} icon={DownloadSimple} />
          <AnalyticsStatCard label={t('epk_analytics_source_portal')} value={epkStats.bySource.portal} icon={DownloadSimple} />
          <AnalyticsStatCard label={t('epk_analytics_source_press')} value={epkStats.bySource.press} icon={DownloadSimple} />
        </div>
      </section>

      <section aria-labelledby="press-downloads-heading">
        <h3 id="press-downloads-heading" className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Newspaper size={18} aria-hidden="true" />
          {t('analytics_press_kit_section')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AnalyticsStatCard label={t('analytics_press_total_downloads')} value={pressStats.totalDownloads} icon={DownloadSimple} />
          <AnalyticsStatCard label={t('analytics_press_last30')} value={pressStats.last30Days} icon={DownloadSimple} />
          <AnalyticsStatCard label={t('analytics_press_journalists')} value={pressStats.uniqueJournalists} icon={Newspaper} />
        </div>
      </section>
    </div>
  )
}