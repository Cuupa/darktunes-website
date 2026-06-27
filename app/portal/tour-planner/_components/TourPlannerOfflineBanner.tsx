'use client'

import { useTranslations } from 'next-intl'
import { CloudSlash, ArrowsClockwise } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useTourPlannerOffline } from '@/lib/tour-planner/offline/useTourPlannerOffline'

export function TourPlannerOfflineBanner() {
  const t = useTranslations('portal')
  const { online, pending, lastSynced, syncing, syncNow } = useTourPlannerOffline()

  if (online && pending === 0) return null

  return (
    <div
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        {!online && <CloudSlash size={18} aria-hidden />}
        <span>
          {!online
            ? t('tour_planner_offline')
            : pending > 0
              ? t('tour_planner_pending_sync', { count: pending })
              : t('tour_planner_last_sync', { time: lastSynced ? new Date(lastSynced).toLocaleString() : '—' })}
        </span>
      </div>
      {online && pending > 0 && (
        <Button size="sm" variant="outline" onClick={() => void syncNow()} disabled={syncing}>
          <ArrowsClockwise size={14} aria-hidden />
          {syncing ? t('tour_planner_syncing') : t('tour_planner_sync_now')}
        </Button>
      )}
    </div>
  )
}