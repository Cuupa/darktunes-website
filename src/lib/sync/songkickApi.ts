/**
 * src/lib/sync/songkickApi.ts
 *
 * Songkick API integration.
 *
 * Fetches upcoming concerts/events for a given Songkick artist ID.
 * Docs: https://www.songkick.com/developer/upcoming-events-for-artist
 */

import { HttpError } from '@/lib/rateLimiter'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SongkickVenue {
  displayName: string
  city: { displayName: string; country: { displayName: string } }
}

export interface SongkickPerformance {
  displayName: string
  billing: string
}

export interface SongkickEvent {
  id: number
  displayName: string
  type: string
  uri: string
  status: string
  start: { date: string | null; time: string | null; datetime: string | null }
  venue: SongkickVenue | null
  performance: SongkickPerformance[]
}

export interface SongkickConcert {
  songkickId: string
  eventName: string
  venueName: string | null
  venueCity: string | null
  venueCountry: string | null
  concertDate: string
  ticketUrl: string
  status: 'ok' | 'cancelled'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches upcoming concerts for a given Songkick artist ID.
 * Returns only events with a valid date.
 */
export async function fetchSongkickArtistCalendar(
  songkickArtistId: string,
  apiKey: string,
  fetchFn: typeof fetch,
): Promise<SongkickConcert[]> {
  const concerts: SongkickConcert[] = []
  let page = 1
  const perPage = 50

  while (true) {
    const url = new URL(
      `https://api.songkick.com/api/3.0/artists/${songkickArtistId}/calendar.json`,
    )
    url.searchParams.set('apikey', apiKey)
    url.searchParams.set('page', String(page))
    url.searchParams.set('per_page', String(perPage))

    const response = await fetchFn(url.toString())

    if (!response.ok) {
      throw new HttpError(
        response.status,
        `Songkick calendar fetch failed: ${response.status}`,
      )
    }

    const data = (await response.json()) as {
      resultsPage: {
        results: { event?: SongkickEvent[] }
        totalEntries: number
        perPage: number
        page: number
      }
    }

    const events = data.resultsPage.results.event ?? []
    for (const event of events) {
      const date = event.start.date
      if (!date) continue

      concerts.push({
        songkickId: String(event.id),
        eventName: event.displayName,
        venueName: event.venue?.displayName ?? null,
        venueCity: event.venue?.city?.displayName ?? null,
        venueCountry: event.venue?.city?.country?.displayName ?? null,
        concertDate: date,
        ticketUrl: event.uri,
        status: event.status === 'cancelled' ? 'cancelled' : 'ok',
      })
    }

    const totalPages = Math.ceil(data.resultsPage.totalEntries / data.resultsPage.perPage)
    if (page >= totalPages || events.length === 0) break
    page++
  }

  return concerts
}
