/**
 * src/lib/sync/spotifyApi.ts
 *
 * Spotify Web API integration.
 *
 * Fetches artist albums (digital releases), high-res cover art, popularity
 * scores, and ISRC data using the Client Credentials OAuth flow.
 *
 * All fetch calls should be wrapped in withExponentialBackoff() at the call
 * site to handle rate limiting.
 */

import { HttpError } from '@/lib/rateLimiter'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpotifyImage {
  url: string
  width: number | null
  height: number | null
}

export interface SpotifyAlbum {
  id: string
  name: string
  album_type: 'album' | 'single' | 'compilation'
  release_date: string
  total_tracks: number
  images: SpotifyImage[]
  external_urls: { spotify: string }
  popularity?: number
  /** Available on the full album object (not on simplified) */
  external_ids?: { upc?: string; ean?: string }
  label?: string
}

export interface SpotifyAlbumWithTracks extends SpotifyAlbum {
  tracks: { items: Array<{ id: string; track_number: number }> }
}

export interface SpotifyRelease {
  spotifyId: string
  title: string
  type: 'album' | 'ep' | 'single'
  releaseDate: string
  coverUrl: string | null
  spotifyUrl: string
  popularity: number | null
  barcode: string | null
  isrc: string | null
}

export interface SpotifyArtistProfile {
  spotifyId: string
  name: string
  imageUrl: string | null
  genres: string[]
  spotifyUrl: string
  popularity: number | null
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

// Module-level token cache — shared across calls within the same process.
// Tests can clear this by importing the module fresh (vi.resetModules).
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

async function getSpotifyAccessToken(
  clientId: string,
  clientSecret: string,
  fetchFn: typeof fetch,
): Promise<string> {
  const cacheKey = clientId
  const cached = tokenCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt - 30_000) return cached.token

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetchFn('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    throw new HttpError(response.status, `Spotify auth failed: ${response.status}`)
  }

  const data = (await response.json()) as { access_token: string; expires_in: number }
  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  })
  return data.access_token
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches all albums for a given Spotify artist ID.
 * Returns simplified release objects with cover art and popularity.
 */
export async function fetchSpotifyArtistReleases(
  spotifyArtistId: string,
  clientId: string,
  clientSecret: string,
  fetchFn: typeof fetch,
): Promise<SpotifyRelease[]> {
  const token = await getSpotifyAccessToken(clientId, clientSecret, fetchFn)

  const url = new URL(`https://api.spotify.com/v1/artists/${spotifyArtistId}/albums`)
  url.searchParams.set('limit', '50')
  url.searchParams.set('include_groups', 'album,single,compilation')

  const response = await fetchFn(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new HttpError(response.status, `Spotify albums fetch failed: ${response.status}`)
  }

  const data = (await response.json()) as { items: SpotifyAlbum[] }

  return data.items.map((album) => ({
    spotifyId: album.id,
    title: album.name,
    type: deriveReleaseType(album.total_tracks, album.album_type),
    releaseDate: normaliseDate(album.release_date),
    coverUrl: album.images[0]?.url ?? null,
    spotifyUrl: album.external_urls.spotify,
    popularity: album.popularity ?? null,
    barcode: album.external_ids?.upc ?? null,
    isrc: null, // ISRC is per-track, not per-album; populated separately
  }))
}

export async function fetchSpotifyArtistProfile(
  spotifyArtistId: string,
  clientId: string,
  clientSecret: string,
  fetchFn: typeof fetch,
): Promise<SpotifyArtistProfile> {
  const token = await getSpotifyAccessToken(clientId, clientSecret, fetchFn)

  const response = await fetchFn(`https://api.spotify.com/v1/artists/${spotifyArtistId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new HttpError(response.status, `Spotify artist fetch failed: ${response.status}`)
  }

  const data = (await response.json()) as {
    id: string
    name: string
    images: SpotifyImage[]
    genres: string[]
    external_urls: { spotify: string }
    popularity?: number
  }

  const largestImage = [...(data.images ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]

  return {
    spotifyId: data.id,
    name: data.name,
    imageUrl: largestImage?.url ?? null,
    genres: data.genres ?? [],
    spotifyUrl: data.external_urls.spotify,
    popularity: data.popularity ?? null,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveReleaseType(
  totalTracks: number,
  albumType: string,
): 'album' | 'ep' | 'single' {
  if (albumType === 'single' || totalTracks === 1) return 'single'
  if (totalTracks <= 6) return 'ep'
  return 'album'
}

/** Normalise Spotify date strings (YYYY, YYYY-MM, YYYY-MM-DD) → YYYY-MM-DD */
function normaliseDate(date: string): string {
  if (/^\d{4}$/.test(date)) return `${date}-01-01`
  if (/^\d{4}-\d{2}$/.test(date)) return `${date}-01`
  return date
}
