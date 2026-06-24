/**
 * Last.fm API client — free listener history for artist analytics.
 * https://www.last.fm/api
 */

export interface LastfmListenerPoint {
  period: string
  listeners: number
}

interface LastfmListenersResponse {
  listeners?: Array<{
    '@attr'?: { from?: string; to?: string }
    date?: { '#text'?: string; uts?: string }
    listeners?: string
  }>
  error?: number
  message?: string
}

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/'

/** Buckets daily Last.fm points into monthly peaks (YYYY-MM). */
export function aggregateLastfmListenersMonthly(
  points: Array<{ date: string; listeners: number }>,
): LastfmListenerPoint[] {
  const byMonth = new Map<string, number>()
  for (const point of points) {
    const month = point.date.slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(month)) continue
    const current = byMonth.get(month) ?? 0
    if (point.listeners > current) byMonth.set(month, point.listeners)
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, listeners]) => ({ period, listeners }))
}

export async function fetchLastfmListenerHistory(
  apiKey: string,
  artistName: string,
  fetchFn: typeof fetch = fetch,
): Promise<LastfmListenerPoint[]> {
  const url = new URL(LASTFM_BASE)
  url.searchParams.set('method', 'artist.getListeners')
  url.searchParams.set('artist', artistName)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('format', 'json')
  url.searchParams.set('autocorrect', '1')

  const res = await fetchFn(url.toString())
  if (!res.ok) {
    throw new Error(`Last.fm request failed (${res.status})`)
  }

  const data = (await res.json()) as LastfmListenersResponse
  if (data.error) {
    throw new Error(data.message ?? `Last.fm error ${data.error}`)
  }

  const raw = (data.listeners ?? [])
    .map((row) => {
      const date = row.date?.['#text'] ?? ''
      const listeners = Number.parseInt(row.listeners ?? '0', 10)
      return { date, listeners: Number.isFinite(listeners) ? listeners : 0 }
    })
    .filter((row) => row.date.length > 0)

  return aggregateLastfmListenersMonthly(raw)
}