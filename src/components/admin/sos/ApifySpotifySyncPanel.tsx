'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowsClockwise, SpotifyLogo } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'

type Scope = 'artists' | 'releases' | 'all'

interface SyncResponse {
  period?: string
  dryRun?: boolean
  budget?: {
    limit: number
    usedBefore: number
    usedAfter: number
    remaining: number
  }
  targets?: {
    artists: number
    releases: number
    skippedInvalidUrl: number
    truncatedByBudget: number
  }
  urlsCharged?: number
  upserted?: { listenerRows: number; trackRows: number }
  partial?: boolean
  errors?: Array<{ spotifyId?: string; message: string }>
  error?: string
}

async function postSync(body: { scope: Scope; dryRun?: boolean }): Promise<SyncResponse> {
  const res = await fetch('/api/admin/analytics/sync-spotify-plays', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as SyncResponse
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Spotify Apify sync failed')
  }
  return data
}

function budgetLabel(data: SyncResponse): string {
  if (!data.budget) return ''
  return ` Budget ${data.budget.usedAfter}/${data.budget.limit} (remaining ${data.budget.remaining}).`
}

export function ApifySpotifySyncPanel() {
  const [isPending, startTransition] = useTransition()
  const [lastSummary, setLastSummary] = useState<string | null>(null)

  const run = (scope: Scope, dryRun: boolean) => {
    startTransition(async () => {
      try {
        const data = await postSync({ scope, dryRun })
        if (dryRun) {
          const msg = `Dry run (${data.period}): ${data.targets?.artists ?? 0} artists, ${data.targets?.releases ?? 0} releases eligible.${budgetLabel(data)}`
          setLastSummary(msg)
          toast.success(msg)
          return
        }
        const errCount = Array.isArray(data.errors) ? data.errors.length : 0
        const partial = data.partial ? ' Partial run — re-run to continue.' : ''
        const msg = `Synced ${scope}: ${data.urlsCharged ?? 0} URLs, ${data.upserted?.listenerRows ?? 0} listener rows, ${data.upserted?.trackRows ?? 0} track rows.${budgetLabel(data)}${errCount > 0 ? ` (${errCount} warnings)` : ''}${partial}`
        setLastSummary(msg)
        toast.success(msg)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Spotify Apify sync failed')
      }
    })
  }

  return (
    <div className="flex flex-col gap-3 p-4 border border-border rounded-lg bg-card/50">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <SpotifyLogo size={16} weight="fill" aria-hidden />
            Spotify public stats (Apify)
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Monthly listeners and catalog play counts for visible artists/releases with a Spotify
            link. Free tier cap 1200 URLs/month. Not settlement data (SOS stays annual source of
            truth). Configure the token under Admin → API Keys → Apify.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => run('all', true)}
          disabled={isPending}
        >
          Dry run
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => run('artists', false)}
          disabled={isPending}
        >
          <ArrowsClockwise size={14} className="mr-1" />
          {isPending ? 'Syncing…' : 'Sync artists'}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => run('releases', false)}
          disabled={isPending}
        >
          Sync releases
        </Button>
        <Button type="button" size="sm" onClick={() => run('all', false)} disabled={isPending}>
          Sync all
        </Button>
      </div>
      {lastSummary && (
        <p className="text-xs text-muted-foreground" role="status">
          {lastSummary}
        </p>
      )}
    </div>
  )
}
