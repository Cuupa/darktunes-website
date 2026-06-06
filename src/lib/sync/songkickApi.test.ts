import { describe, it, expect, vi } from 'vitest'
import { fetchSongkickArtistCalendar } from './songkickApi'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSongkickResponse(events: object[], totalEntries = 1) {
  return {
    resultsPage: {
      results: { event: events },
      totalEntries,
      perPage: 50,
      page: 1,
    },
  }
}

function makeFetchFn(body: object, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchSongkickArtistCalendar', () => {
  it('returns concerts for a single page of results', async () => {
    const event = {
      id: 12345,
      displayName: 'Artist at Venue',
      type: 'Concert',
      uri: 'https://www.songkick.com/concerts/12345',
      status: 'ok',
      start: { date: '2026-08-15', time: '20:00:00', datetime: '2026-08-15T20:00:00+0000' },
      venue: {
        displayName: 'Test Venue',
        city: { displayName: 'Berlin', country: { displayName: 'Germany' } },
      },
      performance: [{ displayName: 'Artist Name', billing: 'headline' }],
    }

    const fetchFn = makeFetchFn(makeSongkickResponse([event], 1))
    const concerts = await fetchSongkickArtistCalendar('sk-artist-1', 'test-api-key', fetchFn)

    expect(concerts).toHaveLength(1)
    expect(concerts[0].songkickId).toBe('12345')
    expect(concerts[0].eventName).toBe('Artist at Venue')
    expect(concerts[0].venueName).toBe('Test Venue')
    expect(concerts[0].venueCity).toBe('Berlin')
    expect(concerts[0].venueCountry).toBe('Germany')
    expect(concerts[0].concertDate).toBe('2026-08-15')
    expect(concerts[0].status).toBe('ok')
  })

  it('marks cancelled events correctly', async () => {
    const event = {
      id: 99999,
      displayName: 'Cancelled Show',
      type: 'Concert',
      uri: 'https://www.songkick.com/concerts/99999',
      status: 'cancelled',
      start: { date: '2026-09-01', time: null, datetime: null },
      venue: null,
      performance: [],
    }

    const fetchFn = makeFetchFn(makeSongkickResponse([event], 1))
    const concerts = await fetchSongkickArtistCalendar('sk-artist-1', 'test-api-key', fetchFn)

    expect(concerts).toHaveLength(1)
    expect(concerts[0].status).toBe('cancelled')
    expect(concerts[0].venueName).toBeNull()
  })

  it('skips events without a date', async () => {
    const event = {
      id: 11111,
      displayName: 'TBA Show',
      type: 'Concert',
      uri: 'https://www.songkick.com/concerts/11111',
      status: 'ok',
      start: { date: null, time: null, datetime: null },
      venue: null,
      performance: [],
    }

    const fetchFn = makeFetchFn(makeSongkickResponse([event], 1))
    const concerts = await fetchSongkickArtistCalendar('sk-artist-1', 'test-api-key', fetchFn)

    expect(concerts).toHaveLength(0)
  })

  it('returns empty array when results are empty', async () => {
    const fetchFn = makeFetchFn(makeSongkickResponse([], 0))
    const concerts = await fetchSongkickArtistCalendar('sk-artist-1', 'test-api-key', fetchFn)
    expect(concerts).toHaveLength(0)
  })

  it('throws HttpError on non-OK HTTP response', async () => {
    const fetchFn = makeFetchFn({}, 403)
    await expect(
      fetchSongkickArtistCalendar('sk-artist-1', 'test-api-key', fetchFn),
    ).rejects.toThrow('403')
  })
})
