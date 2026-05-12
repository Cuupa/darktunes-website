/**
 * src/lib/sync/discogsApi.test.ts
 *
 * Unit tests for cleanDiscogsMarkup and fetchDiscogsArtistProfile.
 */

import { describe, it, expect, vi } from 'vitest'
import { cleanDiscogsMarkup, fetchDiscogsArtistProfile } from './discogsApi'
import { HttpError } from '@/lib/rateLimiter'

// ---------------------------------------------------------------------------
// cleanDiscogsMarkup
// ---------------------------------------------------------------------------

describe('cleanDiscogsMarkup', () => {
  it('strips [a=Name] artist links', () => {
    expect(cleanDiscogsMarkup('[a=Front 242]')).toBe('Front 242')
  })

  it('strips [l=Label] label links', () => {
    expect(cleanDiscogsMarkup('[l=EBM Records]')).toBe('EBM Records')
  })

  it('strips [r=Title] release links', () => {
    expect(cleanDiscogsMarkup('[r=Official Version]')).toBe('Official Version')
  })

  it('strips [m=Title] master links', () => {
    expect(cleanDiscogsMarkup('[m=Master Title]')).toBe('Master Title')
  })

  it('strips [url=…]text[/url] hyperlinks', () => {
    expect(cleanDiscogsMarkup('[url=http://example.com]Visit site[/url]')).toBe('Visit site')
  })

  it('strips bare [a123] numeric artist references', () => {
    expect(cleanDiscogsMarkup('[a12345]')).toBe('')
  })

  it('handles a realistic multi-tag bio string', () => {
    const raw =
      'Band formed by [a=Patrick Codenys] and [a=Jean-Luc De Meyer]. ' +
      'Released on [l=Play It Again Sam]. ' +
      'See [url=http://www.front242.com]official site[/url].'
    const cleaned = cleanDiscogsMarkup(raw)
    expect(cleaned).toContain('Patrick Codenys')
    expect(cleaned).toContain('Jean-Luc De Meyer')
    expect(cleaned).toContain('Play It Again Sam')
    expect(cleaned).toContain('official site')
    expect(cleaned).not.toContain('[a=')
    expect(cleaned).not.toContain('[l=')
    expect(cleaned).not.toContain('[url=')
  })

  it('returns empty string for empty input', () => {
    expect(cleanDiscogsMarkup('')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// fetchDiscogsArtistProfile
// ---------------------------------------------------------------------------

describe('fetchDiscogsArtistProfile', () => {
  const mockDiscogsResponse = {
    id: 123456,
    name: 'Front 242',
    profile: 'Industrial band from [l=Belgium]. Known for [a=EBM] style.',
    images: [
      { uri: 'https://i.discogs.com/primary.jpg', type: 'primary', width: 600, height: 600 },
      { uri: 'https://i.discogs.com/secondary.jpg', type: 'secondary', width: 400, height: 400 },
    ],
    urls: ['https://www.front242.com', 'https://www.facebook.com/front242'],
  }

  it('returns a correctly shaped DiscogsArtistProfile', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDiscogsResponse),
    })

    const profile = await fetchDiscogsArtistProfile('123456', 'test-token', mockFetch as typeof fetch)

    expect(profile.discogsId).toBe('123456')
    expect(profile.name).toBe('Front 242')
    expect(profile.bio).toContain('Industrial band from')
    expect(profile.bio).toContain('Belgium')
    // Markup should be stripped
    expect(profile.bio).not.toContain('[l=')
    expect(profile.imageUrl).toBe('https://i.discogs.com/primary.jpg')
    expect(profile.urls).toEqual(['https://www.front242.com', 'https://www.facebook.com/front242'])
  })

  it('falls back to first image when no primary image is present', async () => {
    const responseWithoutPrimary = {
      ...mockDiscogsResponse,
      images: [
        { uri: 'https://i.discogs.com/first.jpg', type: 'secondary', width: 400, height: 400 },
      ],
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseWithoutPrimary),
    })

    const profile = await fetchDiscogsArtistProfile('123456', undefined, mockFetch as typeof fetch)
    expect(profile.imageUrl).toBe('https://i.discogs.com/first.jpg')
  })

  it('returns null imageUrl when images array is empty', async () => {
    const responseNoImages = { ...mockDiscogsResponse, images: [] }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseNoImages),
    })

    const profile = await fetchDiscogsArtistProfile('123456', undefined, mockFetch as typeof fetch)
    expect(profile.imageUrl).toBeNull()
  })

  it('returns null bio when profile is missing', async () => {
    const responseNoBio = { ...mockDiscogsResponse, profile: undefined }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseNoBio),
    })

    const profile = await fetchDiscogsArtistProfile('123456', undefined, mockFetch as typeof fetch)
    expect(profile.bio).toBeNull()
  })

  it('throws HttpError on non-OK response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })

    await expect(
      fetchDiscogsArtistProfile('999', undefined, mockFetch as typeof fetch),
    ).rejects.toBeInstanceOf(HttpError)
  })

  it('passes Authorization header when token is provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDiscogsResponse),
    })

    await fetchDiscogsArtistProfile('123456', 'my-token', mockFetch as typeof fetch)

    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((callArgs[1].headers as Record<string, string>)['Authorization']).toBe(
      'Discogs token=my-token',
    )
  })

  it('omits Authorization header when token is undefined', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDiscogsResponse),
    })

    await fetchDiscogsArtistProfile('123456', undefined, mockFetch as typeof fetch)

    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((callArgs[1].headers as Record<string, string>)['Authorization']).toBeUndefined()
  })
})
