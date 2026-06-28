/**
 * Last.fm API client — listener snapshots for artist analytics.
 * Uses artist.getInfo (artist.getListeners is not a valid Last.fm method).
 * https://www.last.fm/api/show/artist.getInfo
 */

export interface LastfmListenerPoint {
  period: string
  listeners: number
}

interface LastfmArtistInfoResponse {
  artist?: {
    stats?: {
      listeners?: string
    }
  }
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

/** Returns the current UTC month as YYYY-MM. */
export function currentUtcMonthPeriod(referenceDate = new Date()): string {
  return referenceDate.toISOString().slice(0, 7)
}

export async function fetchLastfmListenerHistory(
  apiKey: string,
  artistName: string,
  fetchFn: typeof fetch = fetch,
): Promise<LastfmListenerPoint[]> {
  const url = new URL(LASTFM_BASE)
  url.searchParams.set('method', 'artist.getInfo')
  url.searchParams.set('artist', artistName)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('format', 'json')
  url.searchParams.set('autocorrect', '1')

  const res = await fetchFn(url.toString())
  const data = (await res.json()) as LastfmArtistInfoResponse

  if (data.error) {
    throw new Error(data.message ?? `Last.fm error ${data.error}`)
  }

  if (!res.ok) {
    throw new Error(`Last.fm request failed (${res.status})`)
  }

  const listeners = Number.parseInt(data.artist?.stats?.listeners ?? '0', 10)
  const period = currentUtcMonthPeriod()

  return [
    {
      period,
      listeners: Number.isFinite(listeners) ? listeners : 0,
    },
  ]
}