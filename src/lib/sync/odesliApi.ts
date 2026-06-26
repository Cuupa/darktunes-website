/**
 * src/lib/sync/odesliApi.ts
 *
 * Odesli (song.link) API integration.
 *
 * Takes any music streaming URL and returns a universal smart link
 * plus platform-specific links.
 *
 * Docs: https://odesli.co/
 * Endpoint: GET https://api.song.link/v1-alpha.1/links?url=<music-url>
 *
 * Free tier: ~10 req/s, no API key required. API key unlocks higher limits.
 */

import { HttpError } from '@/lib/rateLimiter'
import { parseSpotifyUrl } from '@/lib/parsers/platformUrlParser'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OdesliPlatformEntity {
  url: string
  nativeAppUriMobile?: string
  nativeAppUriDesktop?: string
}

export interface OdesliResponse {
  pageUrl: string
  linksByPlatform: Record<string, OdesliPlatformEntity>
  entitiesByUniqueId: Record<
    string,
    {
      id: string
      type: string
      title?: string
      artistName?: string
      thumbnailUrl?: string
      thumbnailWidth?: number
      thumbnailHeight?: number
      apiProvider: string
      platforms: string[]
    }
  >
}

export interface OdesliSmartLink {
  smartUrl: string
  platforms: Record<string, string>
}

const ODESLI_RESOLVABLE_SPOTIFY_TYPES = new Set(['album', 'track'])

/**
 * Returns true when the URL points at an album or track Odesli can resolve.
 * Artist/profile URLs return 405 UNSUPPORTED_URL from the Odesli API.
 */
export function isOdesliResolvableUrl(musicUrl: string): boolean {
  const trimmed = musicUrl.trim()
  if (!trimmed) return false

  const spotify = parseSpotifyUrl(trimmed)
  if (spotify) return ODESLI_RESOLVABLE_SPOTIFY_TYPES.has(spotify.type)

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    if (url.hostname.includes('apple.com')) {
      const parts = url.pathname.split('/').filter(Boolean)
      const typeIndex = parts.findIndex((p) => p === 'album' || p === 'song')
      return typeIndex !== -1 && Boolean(parts[typeIndex + 1])
    }
  } catch {
    return false
  }

  return false
}

/** Expected Odesli failures that should not count as sync errors. */
export function isSkippableOdesliError(err: string): boolean {
  return (
    err.includes('404') ||
    err.includes('No match') ||
    err.includes('405') ||
    err.includes('UNSUPPORTED_URL') ||
    err.includes('422') ||
    err.includes('URL type not supported by Odesli')
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolves a music URL through Odesli and returns the universal smart link
 * plus per-platform URLs.
 *
 * @param musicUrl  - Album or track URL (Spotify, Apple Music, etc.)
 * @param fetchFn   - Injectable fetch (real in prod, mocked in tests)
 */
export async function resolveOdesliSmartLink(
  musicUrl: string,
  fetchFn: typeof fetch,
): Promise<OdesliSmartLink> {
  if (!isOdesliResolvableUrl(musicUrl)) {
    throw new HttpError(422, 'URL type not supported by Odesli')
  }

  const url = new URL('https://api.song.link/v1-alpha.1/links')
  url.searchParams.set('url', musicUrl)

  const response = await fetchFn(url.toString())

  // Read the body as text first so we can provide a meaningful error even when
  // the server returns a non-JSON body (e.g. "An error occurred …").
  const text = await response.text()

  if (!response.ok) {
    throw new HttpError(response.status, `Odesli API failed: ${response.status} — ${text.slice(0, 200)}`)
  }

  let data: OdesliResponse
  try {
    data = JSON.parse(text) as OdesliResponse
  } catch {
    throw new HttpError(response.status, `Odesli returned non-JSON response: ${text.slice(0, 200)}`)
  }

  if (!data.pageUrl) {
    throw new HttpError(response.status, 'Odesli response missing pageUrl')
  }

  const platforms: Record<string, string> = {}
  for (const [platform, entity] of Object.entries(data.linksByPlatform ?? {})) {
    if (entity?.url) platforms[platform] = entity.url
  }

  return {
    smartUrl: data.pageUrl,
    platforms,
  }
}