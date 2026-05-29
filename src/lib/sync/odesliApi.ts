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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolves a music URL through Odesli and returns the universal smart link
 * plus per-platform URLs.
 *
 * @param musicUrl  - Any music streaming URL (Spotify, Apple Music, etc.)
 * @param fetchFn   - Injectable fetch (real in prod, mocked in tests)
 */
export async function resolveOdesliSmartLink(
  musicUrl: string,
  fetchFn: typeof fetch,
): Promise<OdesliSmartLink> {
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

  const platforms: Record<string, string> = {}
  for (const [platform, entity] of Object.entries(data.linksByPlatform)) {
    platforms[platform] = entity.url
  }

  return {
    smartUrl: data.pageUrl,
    platforms,
  }
}
