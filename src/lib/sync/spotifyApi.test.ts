import { describe, it, expect, vi } from 'vitest'
import { fetchSpotifyArtistReleases } from './spotifyApi'

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
    const body = url.includes('accounts.spotify.com') ? tokenResponse : albumResponse
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
