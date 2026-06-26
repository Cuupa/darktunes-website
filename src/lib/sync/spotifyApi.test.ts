import { describe, it, expect, vi } from 'vitest'
import { fetchSpotifyArtistProfile, fetchSpotifyArtistReleases } from './spotifyApi'

const TOKEN_RESPONSE = {
  access_token: 'test-token',
  expires_in: 3600,
}

const ALBUM_RESPONSE = {
  items: [
    {
      id: 'album1',
      name: 'Dark Pulse',
      album_type: 'album',
      release_date: '2024-06-15',
      total_tracks: 10,
      images: [{ url: 'https://i.scdn.co/image/art.jpg', width: 640, height: 640 }],
      external_urls: { spotify: 'https://open.spotify.com/album/album1' },
      popularity: 65,
      external_ids: { upc: '123456789012' },
    },
    {
      id: 'single1',
      name: 'Bass Drop',
      album_type: 'single',
      release_date: '2024-03-01',
      total_tracks: 1,
      images: [{ url: 'https://i.scdn.co/image/single.jpg', width: 640, height: 640 }],
      external_urls: { spotify: 'https://open.spotify.com/album/single1' },
      popularity: 40,
      external_ids: {},
    },
  ],
}

function makeFetch(tokenResponse: unknown, albumResponse: unknown) {
  return vi.fn().mockImplementation(async (url: string) => {
    const hostname = new URL(url).hostname
    const body = hostname === 'accounts.spotify.com' ? tokenResponse : albumResponse
    return {
      ok: true,
      json: async () => body,
    } as Response
  })
}

describe('fetchSpotifyArtistReleases', () => {
  it('fetches and maps releases correctly', async () => {
    const mockFetch = makeFetch(TOKEN_RESPONSE, ALBUM_RESPONSE)

    const releases = await fetchSpotifyArtistReleases(
      'artist123',
      'client-id',
      'client-secret',
      mockFetch,
    )

    expect(releases).toHaveLength(2)
    expect(releases[0].spotifyId).toBe('album1')
    expect(releases[0].title).toBe('Dark Pulse')
    expect(releases[0].type).toBe('album')
    expect(releases[0].releaseDate).toBe('2024-06-15')
    expect(releases[0].coverUrl).toBe('https://i.scdn.co/image/art.jpg')
    expect(releases[0].popularity).toBe(65)
    expect(releases[0].barcode).toBe('123456789012')
  })

  it('maps single album_type to single type', async () => {
    const mockFetch = makeFetch(TOKEN_RESPONSE, ALBUM_RESPONSE)
    const releases = await fetchSpotifyArtistReleases('a', 'id', 'secret', mockFetch)
    expect(releases[1].type).toBe('single')
  })

  it('normalises year-only release dates', async () => {
    const response = {
      items: [
        {
          id: 'old1',
          name: 'Old Album',
          album_type: 'album',
          release_date: '2019',
          total_tracks: 8,
          images: [],
          external_urls: { spotify: 'https://open.spotify.com/album/old1' },
          external_ids: {},
        },
      ],
    }
    const mockFetch = makeFetch(TOKEN_RESPONSE, response)
    const releases = await fetchSpotifyArtistReleases('a', 'id', 'secret', mockFetch)
    expect(releases[0].releaseDate).toBe('2019-01-01')
  })

  it('uses API-compliant limit, market, and unencoded include_groups', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      const hostname = new URL(url).hostname
      if (hostname === 'accounts.spotify.com') {
        return { ok: true, json: async () => TOKEN_RESPONSE } as Response
      }
      expect(url).toContain('/artists/1Cs0zKBU1kc0i8ypK3B9ai/albums')
      expect(url).toContain('limit=10')
      expect(url).toContain('market=DE')
      expect(url).not.toContain('limit=20')
      expect(url).not.toContain('%2C')
      return { ok: true, json: async () => ALBUM_RESPONSE } as Response
    })

    await fetchSpotifyArtistReleases(
      'https://open.spotify.com/intl-de/artist/1Cs0zKBU1kc0i8ypK3B9ai',
      'client-id',
      'client-secret',
      mockFetch,
    )
  })

  it('throws HttpError for invalid Spotify artist identifiers', async () => {
    const mockFetch = makeFetch(TOKEN_RESPONSE, ALBUM_RESPONSE)
    await expect(
      fetchSpotifyArtistReleases('https://open.spotify.com/album/not-an-artist', 'id', 'secret', mockFetch),
    ).rejects.toThrow('Invalid Spotify artist ID')
  })

  it('returns empty array when Spotify response has no items', async () => {
    const mockFetch = makeFetch(TOKEN_RESPONSE, {})
    const releases = await fetchSpotifyArtistReleases('artist123', 'id', 'secret', mockFetch)
    expect(releases).toEqual([])
  })

  it('paginates when Spotify returns a next page link', async () => {
    let albumsCall = 0
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (new URL(url).hostname === 'accounts.spotify.com') {
        return { ok: true, json: async () => TOKEN_RESPONSE } as Response
      }
      albumsCall++
      if (albumsCall === 1) {
        expect(url).toContain('offset=0')
        return {
          ok: true,
          json: async () => ({
            items: ALBUM_RESPONSE.items.slice(0, 1),
            next: 'https://api.spotify.com/v1/artists/a/albums?offset=10',
          }),
        } as Response
      }
      expect(url).toContain('offset=10')
      return {
        ok: true,
        json: async () => ({
          items: ALBUM_RESPONSE.items.slice(1),
          next: null,
        }),
      } as Response
    })

    const releases = await fetchSpotifyArtistReleases('artist123', 'id', 'secret', mockFetch)
    expect(releases).toHaveLength(2)
    expect(albumsCall).toBe(2)
  })

  it('throws HttpError when the Spotify API returns a non-ok status', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('accounts.spotify.com')) {
        return { ok: true, json: async () => TOKEN_RESPONSE } as Response
      }
      return { ok: false, status: 429 } as Response
    })

    await expect(
      fetchSpotifyArtistReleases('a', 'id', 'secret', mockFetch),
    ).rejects.toThrow('429')
  })
})

describe('fetchSpotifyArtistProfile', () => {
  it('returns mapped profile and uses largest image', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (new URL(url).hostname === 'accounts.spotify.com') {
        return { ok: true, json: async () => TOKEN_RESPONSE } as Response
      }
      return {
        ok: true,
        json: async () => ({
          id: 'artist123',
          name: 'Dark Artist',
          images: [
            { url: 'https://i.scdn.co/image/320.jpg', width: 320, height: 320 },
            { url: 'https://i.scdn.co/image/640.jpg', width: 640, height: 640 },
          ],
          genres: ['industrial', 'ebm'],
          external_urls: { spotify: 'https://open.spotify.com/artist/artist123' },
          popularity: 77,
        }),
      } as Response
    })

    const profile = await fetchSpotifyArtistProfile('artist123', 'profile-id', 'secret', mockFetch)

    expect(profile).toEqual({
      spotifyId: 'artist123',
      name: 'Dark Artist',
      imageUrl: 'https://i.scdn.co/image/640.jpg',
      genres: ['industrial', 'ebm'],
      spotifyUrl: 'https://open.spotify.com/artist/artist123',
      popularity: 77,
    })
  })

  it('throws HttpError when profile endpoint is not ok', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (new URL(url).hostname === 'accounts.spotify.com') {
        return { ok: true, json: async () => TOKEN_RESPONSE } as Response
      }
      return { ok: false, status: 500 } as Response
    })

    await expect(
      fetchSpotifyArtistProfile('artist123', 'profile-id-2', 'secret', mockFetch),
    ).rejects.toThrow('500')
  })
})
