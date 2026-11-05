'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { horizontalScrollClass } from '@/components/ui/scroll-panel'
import type { SyncOverview } from '@/lib/api/syncOverview'

export function SyncCoveragePanel({ bearerToken }: { bearerToken: string }) {
  const t = useTranslations('admin.syncCoverage')
  const locale = useLocale()
  const [data, setData] = useState<SyncOverview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async (cursor?: string) => {
    setBusy(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '25' })
      if (cursor) params.set('cursor', cursor)
      const response = await fetch(`/api/admin/sync/artist-states?${params}`, {
        headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined,
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(String(response.status))
      const result: SyncOverview = await response.json()
      setData((previous) => cursor && previous ? { ...result, items: [...previous.items, ...result.items] } : result)
    } catch {
      setError(t('loadError'))
    } finally {
      setBusy(false)
    }
  }, [bearerToken, t])
  useEffect(() => { void load() }, [load])
  const date = (value: string | null) => value ? new Date(value).toLocaleString(locale) : t('never')
  const status = (value: string) => {
    switch (value) {
      case 'success': return t('success')
      case 'scheduled': return t('scheduled')
      case 'cooldown': return t('cooldown')
      case 'permanent': return t('configuration')
      default: return t('failed')
    }
  }
  return <Card>
    <CardHeader className="flex-row flex-wrap items-start gap-3">
      <div className="flex-1"><CardTitle>{t('title')}</CardTitle><CardDescription>{t('description')}</CardDescription></div>
      <Button variant="outline" disabled={busy} onClick={() => void load()}>{t('refresh')}</Button>
    </CardHeader>
    <CardContent className="space-y-4" aria-busy={busy}>
      {error && <p role="alert">{error}</p>}
      <ul className="flex flex-wrap gap-3">
        {data?.providers.map((provider) => <li key={provider.provider} className="rounded border p-3 text-sm">
          <strong className="capitalize">{provider.provider}</strong>
          <p>{new Date(provider.cooldown_until).getTime() > Date.now() ? t('pausedUntil', { date: date(provider.cooldown_until) }) : t('ready')}</p>
        </li>)}
      </ul>
      <div className={horizontalScrollClass}>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{t('title')}</caption>
          <thead><tr>{(['artist', 'provider', 'status', 'lastSuccess', 'nextDue'] as const).map((key) => <th key={key} className="p-2">{t(key)}</th>)}</tr></thead>
          <tbody>{data?.items.map((artist) => artist.states.length ? artist.states.map((state) => <tr key={`${artist.artist_id}:${state.provider}`} className="border-t">
            <td className="p-2">{artist.artist_name}</td><td className="p-2 capitalize">{state.provider}</td>
            <td className="p-2"><span>{status(state.last_status)}</span>{state.last_error && <p className="max-w-sm break-words text-muted-foreground">{state.last_error}</p>}</td>
            <td className="p-2 whitespace-nowrap">{date(state.last_success_at)}</td><td className="p-2 whitespace-nowrap">{state.last_status === 'permanent' ? t('reviewRequired') : date(state.next_due_at)}</td>
          </tr>) : <tr key={artist.artist_id} className="border-t"><td className="p-2">{artist.artist_name}</td><td colSpan={4} className="p-2 text-muted-foreground">{t('noCheckpoint')}</td></tr>)}</tbody>
        </table>
      </div>
      {data?.next_cursor && <Button variant="outline" disabled={busy} onClick={() => void load(data.next_cursor ?? undefined)}>{t('more')}</Button>}
    </CardContent>
  </Card>
}
