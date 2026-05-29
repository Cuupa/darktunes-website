import { describe, it, expect, vi } from 'vitest'
import { resolveOdesliSmartLink } from './odesliApi'

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

describe('resolveOdesliSmartLink', () => {
  it('returns smart link and platform URLs on success', async () => {
    const fetch = makeFetch(200, VALID_RESPONSE)
    const result = await resolveOdesliSmartLink('https://open.spotify.com/track/abc123', fetch)
    expect(result.smartUrl).toBe('https://song.link/s/abc123')
    expect(result.platforms.spotify).toBe('https://open.spotify.com/track/abc123')
    expect(result.platforms.appleMusic).toBe('https://music.apple.com/album/abc123')
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
})
