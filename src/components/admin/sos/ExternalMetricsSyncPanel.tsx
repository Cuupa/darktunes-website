'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowsClockwise, Waveform } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

export function ExternalMetricsSyncPanel() {
  const [isPending, startTransition] = useTransition()

  const handleSync = () => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/analytics/sync-listeners', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(typeof data?.error === 'string' ? data.error : 'Sync failed')
        }
        const errCount = Array.isArray(data.errors) ? data.errors.length : 0
        toast.success(
          `Synced listeners: ${data.lastfmRows ?? 0} Last.fm, ${data.soundchartsRows ?? 0} Soundcharts` +
            (errCount > 0 ? ` (${errCount} artist errors)` : ''),
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Listener sync failed')
      }
    })
  }

  return (
    <div className="flex items-center justify-between gap-4 p-4 border border-border rounded-lg bg-card/50">
      <div>
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Waveform size={16} />
          External Listener Data
        </p>
        <p className="text-xs text-muted-foreground">
          Pull monthly listener trends from Last.fm (free) and Soundcharts (optional API key).
        </p>
      </div>
      <Button type="button" size="sm" onClick={handleSync} disabled={isPending}>
        <ArrowsClockwise size={14} className="mr-1" />
        {isPending ? 'Syncing…' : 'Sync Listeners'}
      </Button>
    </div>
  )
}