'use client'

/**
 * src/components/epk-builder/EpkDownloadStatsPanel.tsx
 *
 * Read-only EPK PDF download analytics for portal artists.
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChartBar } from '@phosphor-icons/react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { EpkDownloadStats } from '@/lib/api/epkDownloadEvents'

interface EpkDownloadStatsPanelProps {
  open: boolean
  onClose: () => void
  artistId: string
}

export function EpkDownloadStatsPanel({
  open,
  onClose,
  artistId,
}: EpkDownloadStatsPanelProps) {
  const t = useTranslations('portal')
  const [stats, setStats] = useState<EpkDownloadStats | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const res = await fetch(`/api/portal/epk/analytics?artist_id=${artistId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('fetch failed')
      const data = (await res.json()) as { stats: EpkDownloadStats }
      setStats(data.stats)
    } catch {
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [artistId])

  useEffect(() => {
    if (open) void fetchStats()
  }, [open, fetchStats])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        className="max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-xl p-0"
        aria-labelledby="epk-analytics-title"
      >
        <DialogHeader className="p-6 pb-0">
          <DialogTitle id="epk-analytics-title" className="flex items-center gap-2">
            <ChartBar size={20} aria-hidden="true" />
            {t('epk_analytics_title')}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto max-h-[70vh] p-6 space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('epk_analytics_loading')}</p>
          ) : !stats ? (
            <p className="text-sm text-muted-foreground">{t('epk_analytics_error')}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">{t('epk_analytics_total')}</p>
                  <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">{t('epk_analytics_last_30')}</p>
                  <p className="text-2xl font-bold tabular-nums">{stats.last30Days}</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between rounded-lg border border-border px-4 py-3">
                  <span>{t('epk_analytics_source_portal')}</span>
                  <span className="font-medium tabular-nums">{stats.bySource.portal}</span>
                </li>
                <li className="flex justify-between rounded-lg border border-border px-4 py-3">
                  <span>{t('epk_analytics_source_share')}</span>
                  <span className="font-medium tabular-nums">{stats.bySource.share}</span>
                </li>
                <li className="flex justify-between rounded-lg border border-border px-4 py-3">
                  <span>{t('epk_analytics_source_press')}</span>
                  <span className="font-medium tabular-nums">{stats.bySource.press}</span>
                </li>
              </ul>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}