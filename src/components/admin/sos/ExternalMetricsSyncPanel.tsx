'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowsClockwise, Waveform } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { useDict } from '@/contexts/DictContext'
import { interpolate } from '@/lib/i18n/interpolate'

const SYNC_FALLBACK = {
  syncTitle: 'External Listener Data',
  syncDescription:
    'Pull monthly listener trends from Last.fm (free) and Soundcharts (optional API key).',
  syncButton: 'Sync Listeners',
  syncing: 'Syncing…',
  syncSuccess: 'Synced listeners: {lastfm} Last.fm, {soundcharts} Soundcharts{errors}',
  syncFailed: 'Listener sync failed',
} as const

export function ExternalMetricsSyncPanel() {
  const dict = useDict()
  const t = { ...SYNC_FALLBACK, ...dict.admin?.accounting }
  const [isPending, startTransition] = useTransition()

  const handleSync = () => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/analytics/sync-listeners', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(typeof data?.error === 'string' ? data.error : t.syncFailed)
        }
        const errCount = Array.isArray(data.errors) ? data.errors.length : 0
        toast.success(
          interpolate(t.syncSuccess, {
            lastfm: data.lastfmRows ?? 0,
            soundcharts: data.soundchartsRows ?? 0,
            errors: errCount > 0 ? ` (${errCount} artist errors)` : '',
          }),
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.syncFailed)
      }
    })
  }

  return (
    <div className="flex items-center justify-between gap-4 p-4 border border-border rounded-lg bg-card/50">
      <div>
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Waveform size={16} />
          {t.syncTitle}
        </p>
        <p className="text-xs text-muted-foreground">{t.syncDescription}</p>
      </div>
      <Button type="button" size="sm" onClick={handleSync} disabled={isPending}>
        <ArrowsClockwise size={14} className="mr-1" />
        {isPending ? t.syncing : t.syncButton}
      </Button>
    </div>
  )
}