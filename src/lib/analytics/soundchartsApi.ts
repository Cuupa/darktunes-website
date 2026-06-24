/**
 * Soundcharts API client (optional paid tier).
 * Disabled when SOUNDCHARTS_API_KEY is not configured.
 */

export interface SoundchartsListenerPoint {
  period: string
  listeners: number
}

interface SoundchartsAudienceResponse {
  items?: Array<{
    date?: string
    value?: number
  }>
}

const SOUNDCHARTS_BASE = 'https://customer.api.soundcharts.com'

export function isSoundchartsConfigured(apiKey: string | undefined): boolean {
  return Boolean(apiKey?.trim())
}

/**
 * Fetches monthly listener counts when a Soundcharts UUID and API key are set.
 */
export async function fetchSoundchartsListenerHistory(
  apiKey: string,
  soundchartsUuid: string,
  fetchFn: typeof fetch = fetch,
): Promise<SoundchartsListenerPoint[]> {
  const url = `${SOUNDCHARTS_BASE}/api/v2/artist/${encodeURIComponent(soundchartsUuid)}/audience/spotify/listeners?startDate=2015-01-01`
  const res = await fetchFn(url, {
    headers: {
      'x-app-id': apiKey,
      'x-api-key': apiKey,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`Soundcharts request failed (${res.status})`)
  }

  const data = (await res.json()) as SoundchartsAudienceResponse
  const byMonth = new Map<string, number>()

  for (const item of data.items ?? []) {
    const date = item.date ?? ''
    const month = date.slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(month)) continue
    const value = item.value ?? 0
    const current = byMonth.get(month) ?? 0
    if (value > current) byMonth.set(month, value)
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, listeners]) => ({ period, listeners }))
}