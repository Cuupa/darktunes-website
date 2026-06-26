import { describe, it, expect, vi } from 'vitest'
import {
  isOdesliResolvableUrl,
  isSkippableOdesliError,
  pickOdesliMusicUrl,
  resolveOdesliSmartLink,
} from './odesliApi'

const VALID_RESPONSE = {
  pageUrl: 'https://song.link/s/abc123',
  linksByPlatform: {
    spotify: { url: 'https://open.spotify.com/track/abc123' },
    appleMusic: { url: 'https://music.apple.com/album/abc123' },
  },
  entitiesByUniqueId: {},
}

function makeFetch(status: number, body: unknown, contentType = 'application/json') {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(text),
    headers: { get: () => contentType },
  })
}

describe('isOdesliResolvableUrl', () => {
  it('accepts Spotify album and track URLs', () => {
    expect(isOdesliResolvableUrl('https://open.spotify.com/album/xyz')).toBe(true)
    expect(isOdesliResolvableUrl('https://open.spotify.com/track/abc')).toBe(true)
  })

  it('rejects Spotify artist profile URLs', () => {
    expect(isOdesliResolvableUrl('https://open.spotify.com/artist/abc123')).toBe(false)
  })

  it('accepts Apple Music album URLs', () => {
    expect(isOdesliResolvableUrl('https://music.apple.com/de/album/name/123')).toBe(true)
  })

  it('rejects Apple Music artist URLs', () => {
    expect(isOdesliResolvableUrl('https://music.apple.com/de/artist/name/123')).toBe(false)
  })
})

describe('pickOdesliMusicUrl', () => {
  it('prefers resolvable Spotify album URL over artist profile URL', () => {
    expect(
      pickOdesliMusicUrl(
        'https://open.spotify.com/artist/bad',
        'https://open.spotify.com/album/good',
      ),
    ).toBe('https://open.spotify.com/album/good')
  })

  it('falls back to Apple Music album when Spotify URL is an artist profile', () => {
    expect(
      pickOdesliMusicUrl(
        'https://open.spotify.com/artist/bad',
        'https://music.apple.com/de/album/name/123',
      ),
    ).toBe('https://music.apple.com/de/album/name/123')
  })

  it('returns null when neither URL is resolvable', () => {
    expect(
      pickOdesliMusicUrl(
        'https://open.spotify.com/artist/bad',
        'https://music.apple.com/de/artist/name/123',
      ),
    ).toBeNull()
  })
})

describe('isSkippableOdesliError', () => {
  it('treats unsupported URL responses as skippable', () => {
    expect(isSkippableOdesliError('Odesli API failed: 405 — UNSUPPORTED_URL')).toBe(true)
    expect(isSkippableOdesliError('URL type not supported by Odesli')).toBe(true)
    expect(isSkippableOdesliError('Odesli API failed: 500')).toBe(false)
  })
})

describe('resolveOdesliSmartLink', () => {
  it('returns smart link and platform URLs on success', async () => {
    const fetch = makeFetch(200, VALID_RESPONSE)
    const result = await resolveOdesliSmartLink('https://open.spotify.com/track/abc123', fetch)
    expect(result.smartUrl).toBe('https://song.link/s/abc123')
    expect(result.platforms.spotify).toBe('https://open.spotify.com/track/abc123')
    expect(result.platforms.appleMusic).toBe('https://music.apple.com/album/abc123')
  })

  it('rejects artist URLs without calling the API', async () => {
    const fetch = makeFetch(200, VALID_RESPONSE)
    await expect(
      resolveOdesliSmartLink('https://open.spotify.com/artist/abc123', fetch),
    ).rejects.toThrow('URL type not supported by Odesli')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('throws HttpError on non-200 JSON response', async () => {
    const fetch = makeFetch(404, { message: 'Not found' })
    await expect(resolveOdesliSmartLink('https://open.spotify.com/track/bad', fetch)).rejects.toThrow(
      'Odesli API failed: 404',
    )
  })

  it('throws descriptive error when API returns non-JSON text body (e.g. "An error occurred")', async () => {
    const fetch = makeFetch(200, 'An error occurred. Please try again later.', 'text/html')
    await expect(
      resolveOdesliSmartLink('https://open.spotify.com/track/abc', fetch),
    ).rejects.toThrow('Odesli returned non-JSON response')
  })

  it('includes truncated response text in error message for non-JSON body', async () => {
    const fetch = makeFetch(503, 'Service Unavailable')
    await expect(
      resolveOdesliSmartLink('https://open.spotify.com/track/abc', fetch),
    ).rejects.toThrow('Service Unavailable')
  })

  it('throws when API returns error status with plain-text body', async () => {
    const fetch = makeFetch(500, 'Internal Server Error', 'text/plain')
    await expect(
      resolveOdesliSmartLink('https://open.spotify.com/track/abc', fetch),
    ).rejects.toThrow('Odesli API failed: 500')
  })

  it('throws when success response is missing pageUrl', async () => {
    const fetch = makeFetch(200, { linksByPlatform: {} })
    await expect(
      resolveOdesliSmartLink('https://open.spotify.com/track/abc', fetch),
    ).rejects.toThrow('missing pageUrl')
  })

  it('handles missing linksByPlatform gracefully', async () => {
    const fetch = makeFetch(200, { pageUrl: 'https://song.link/s/only' })
    const result = await resolveOdesliSmartLink('https://open.spotify.com/track/abc', fetch)
    expect(result.smartUrl).toBe('https://song.link/s/only')
    expect(result.platforms).toEqual({})
  })
})