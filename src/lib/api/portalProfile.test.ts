import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { uploadRiderDocument, saveArtistProfile } from './portalProfile'
import type { ArtistProfilePayload } from './portalProfile'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

const minimalPayload: ArtistProfilePayload = {
  artist_id: 'artist-1',
  bio: 'A bio',
  bio_short: null,
  bio_medium: null,
  bio_long: null,
  genres: ['electronic'],
  press_quote: null,
  founding_year: null,
  hometown: null,
  booking_contact: null,
  press_contact: null,
  website_url: null,
  instagram_url: null,
  youtube_url: null,
  bandcamp_url: null,
  spotify_url: null,
  apple_music_url: null,
  tiktok_url: null,
  facebook_url: null,
  soundcloud_url: null,
  rider_stage_plot_url: null,
  rider_technical_url: null,
  rider_hospitality_url: null,
}

// ---------------------------------------------------------------------------
// uploadRiderDocument
// ---------------------------------------------------------------------------

describe('uploadRiderDocument', () => {
  let restoreFetch: () => void

  beforeEach(() => {
    const original = globalThis.fetch
    restoreFetch = () => {
      globalThis.fetch = original
    }
  })

  afterEach(() => restoreFetch())

  it('returns URL on success', async () => {
    globalThis.fetch = mockFetch(200, { url: 'https://cdn.example.com/rider.pdf' })
    const url = await uploadRiderDocument(
      new File(['pdf'], 'rider.pdf', { type: 'application/pdf' }),
      'stage_plot',
      'test-token',
    )
    expect(url).toBe('https://cdn.example.com/rider.pdf')
  })

  it('throws on non-OK response', async () => {
    globalThis.fetch = mockFetch(422, {})
    await expect(
      uploadRiderDocument(
        new File(['pdf'], 'rider.pdf', { type: 'application/pdf' }),
        'technical',
        'test-token',
      ),
    ).rejects.toThrow('Upload failed')
  })

  it('throws when response has no url', async () => {
    globalThis.fetch = mockFetch(200, {})
    await expect(
      uploadRiderDocument(
        new File(['pdf'], 'rider.pdf', { type: 'application/pdf' }),
        'hospitality',
        'test-token',
      ),
    ).rejects.toThrow('No URL in response')
  })
})

// ---------------------------------------------------------------------------
// saveArtistProfile
// ---------------------------------------------------------------------------

describe('saveArtistProfile', () => {
  let restoreFetch: () => void

  beforeEach(() => {
    const original = globalThis.fetch
    restoreFetch = () => {
      globalThis.fetch = original
    }
  })

  afterEach(() => restoreFetch())

  it('resolves without error on 200', async () => {
    const mockFn = mockFetch(200, {})
    globalThis.fetch = mockFn
    await expect(saveArtistProfile(minimalPayload, 'tok')).resolves.toBeUndefined()

    const [url, init] = mockFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/portal/profile')
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok')
    const parsed = JSON.parse(init.body as string) as ArtistProfilePayload
    expect(parsed.artist_id).toBe('artist-1')
    expect(parsed.genres).toEqual(['electronic'])
  })

  it('throws on non-OK response', async () => {
    globalThis.fetch = mockFetch(500, {})
    await expect(saveArtistProfile(minimalPayload, 'tok')).rejects.toThrow('Save failed')
  })
})
