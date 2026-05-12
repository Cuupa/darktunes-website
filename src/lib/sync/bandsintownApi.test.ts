/**
 * src/lib/sync/bandsintownApi.test.ts
 *
 * Unit tests for fetchBandsintownArtistEvents.
 */

import { describe, it, expect, vi } from 'vitest'
import { fetchBandsintownArtistEvents } from './bandsintownApi'
import { HttpError } from '@/lib/rateLimiter'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bt-123',
    artist_id: '456',
    url: 'https://www.bandsintown.com/e/bt-123',
    datetime: '2026-09-10T20:00:00',
    description: null,
    venue: {
      name: 'Berghain',
      city: 'Berlin',
      region: '',
      country: 'Germany',
      latitude: '52.5',
      longitude: '13.4',
    },
    offers: [
      { type: 'Tickets', url: 'https://tickets.example.com/bt-123', status: 'available' },
    ],
    lineup: ['DarkArtist'],
    festival_name: null,
    title: null,
    on_sale_datetime: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// fetchBandsintownArtistEvents
// ---------------------------------------------------------------------------

describe('fetchBandsintownArtistEvents', () => {
  it('maps a standard event to BandsintownConcert shape', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([makeMockEvent()]),
    })

    const concerts = await fetchBandsintownArtistEvents('DarkArtist', 'test-api-key', mockFetch as typeof fetch)

    expect(concerts).toHaveLength(1)
    expect(concerts[0]).toEqual({
      bandsintownId: 'bt-123',
      eventName: 'DarkArtist',
      venueName: 'Berghain',
      venueCity: 'Berlin',
      venueCountry: 'Germany',
      concertDate: '2026-09-10',
      ticketUrl: 'https://tickets.example.com/bt-123',
      status: 'ok',
    })
  })

  it('passes BANDSINTOWN_API_KEY as app_id query parameter', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    await fetchBandsintownArtistEvents('DarkArtist', 'my-secret-key', mockFetch as typeof fetch)

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('app_id=my-secret-key')
    expect(calledUrl).toContain('date=upcoming')
    expect(calledUrl).toContain('DarkArtist')
  })

  it('URL-encodes artist names with special characters', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    await fetchBandsintownArtistEvents('AC/DC & Friends', 'key', mockFetch as typeof fetch)

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).not.toContain('AC/DC & Friends')
    expect(calledUrl).toContain(encodeURIComponent('AC/DC & Friends'))
  })

  it('uses title as eventName when present', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([makeMockEvent({ title: 'Headliner Night' })]),
    })

    const concerts = await fetchBandsintownArtistEvents('DarkArtist', 'key', mockFetch as typeof fetch)
    expect(concerts[0].eventName).toBe('Headliner Night')
  })

  it('falls back to festival_name when title is null', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([makeMockEvent({ title: null, festival_name: 'Summer of Darkness' })]),
    })

    const concerts = await fetchBandsintownArtistEvents('DarkArtist', 'key', mockFetch as typeof fetch)
    expect(concerts[0].eventName).toBe('Summer of Darkness')
  })

  it('falls back to lineup join when title and festival_name are null', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([makeMockEvent({ title: null, festival_name: null, lineup: ['ArtistA', 'ArtistB'] })]),
    })

    const concerts = await fetchBandsintownArtistEvents('ArtistA', 'key', mockFetch as typeof fetch)
    expect(concerts[0].eventName).toBe('ArtistA, ArtistB')
  })

  it('uses event URL as ticketUrl when no Tickets offer is present', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([makeMockEvent({ offers: [], url: 'https://www.bandsintown.com/e/fallback' })]),
    })

    const concerts = await fetchBandsintownArtistEvents('DarkArtist', 'key', mockFetch as typeof fetch)
    expect(concerts[0].ticketUrl).toBe('https://www.bandsintown.com/e/fallback')
  })

  it('skips events with no datetime', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([makeMockEvent({ datetime: null })]),
    })

    const concerts = await fetchBandsintownArtistEvents('DarkArtist', 'key', mockFetch as typeof fetch)
    expect(concerts).toHaveLength(0)
  })

  it('returns empty array when Bandsintown returns an error object (artist not found)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: 'Artist not found' }),
    })

    const concerts = await fetchBandsintownArtistEvents('UnknownArtist', 'key', mockFetch as typeof fetch)
    expect(concerts).toHaveLength(0)
  })

  it('returns empty array for an empty events list', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    const concerts = await fetchBandsintownArtistEvents('DarkArtist', 'key', mockFetch as typeof fetch)
    expect(concerts).toHaveLength(0)
  })

  it('throws HttpError on a non-OK HTTP response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 429 })

    await expect(
      fetchBandsintownArtistEvents('DarkArtist', 'key', mockFetch as typeof fetch),
    ).rejects.toBeInstanceOf(HttpError)
  })

  it('handles multiple events correctly', async () => {
    const event1 = makeMockEvent({ id: 'evt-1', datetime: '2026-09-10T20:00:00' })
    const event2 = makeMockEvent({ id: 'evt-2', datetime: '2026-10-01T19:30:00', title: 'Second Show' })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([event1, event2]),
    })

    const concerts = await fetchBandsintownArtistEvents('DarkArtist', 'key', mockFetch as typeof fetch)
    expect(concerts).toHaveLength(2)
    expect(concerts[1].bandsintownId).toBe('evt-2')
    expect(concerts[1].concertDate).toBe('2026-10-01')
    expect(concerts[1].eventName).toBe('Second Show')
  })
})
