/**
 * Normalize Spotify artist/album identities into open.spotify.com URLs
 * for the Apify Spotify Play Count Scraper.
 */

export type SpotifyEntityKind = 'artist' | 'album'

export interface ResolvedSpotifyUrl {
  kind: SpotifyEntityKind
  id: string
  url: string
}

const SPOTIFY_ID_RE = /^[a-zA-Z0-9]{22}$/

/** Build canonical open.spotify.com URL from a bare Spotify id. */
export function buildSpotifyOpenUrl(kind: SpotifyEntityKind, id: string): string {
  const trimmed = id.trim()
  return `https://open.spotify.com/${kind}/${trimmed}`
}

/**
 * Extract a Spotify id from bare id, open.spotify.com URL, or spotify: URI.
 * Returns null when the value cannot be resolved for the expected kind.
 */
export function parseSpotifyId(
  kind: SpotifyEntityKind,
  raw: string | null | undefined,
): string | null {
  if (!raw) return null
  const value = raw.trim()
  if (!value) return null

  if (SPOTIFY_ID_RE.test(value)) return value

  const uriPrefix = `spotify:${kind}:`
  if (value.toLowerCase().startsWith(uriPrefix)) {
    const id = value.slice(uriPrefix.length).split(/[?#]/)[0]?.trim()
    return id && SPOTIFY_ID_RE.test(id) ? id : null
  }

  try {
    const withProtocol = value.startsWith('http') ? value : `https://${value}`
    const parsed = new URL(withProtocol)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
    if (host !== 'open.spotify.com' && host !== 'spotify.com') return null

    // Paths: /artist/{id}, /album/{id}, /intl-de/artist/{id}, …
    const parts = parsed.pathname.split('/').filter(Boolean)
    const kindIdx = parts.findIndex((p) => p.toLowerCase() === kind)
    if (kindIdx < 0 || kindIdx + 1 >= parts.length) return null
    const id = parts[kindIdx + 1]?.split('?')[0]
    return id && SPOTIFY_ID_RE.test(id) ? id : null
  } catch {
    return null
  }
}

/**
 * Resolve id and/or url fields into a scrapeable open.spotify.com URL.
 * Prefers explicit spotify_id over parsing spotify_url.
 */
export function resolveSpotifyEntityUrl(
  kind: SpotifyEntityKind,
  spotifyId: string | null | undefined,
  spotifyUrl: string | null | undefined,
): ResolvedSpotifyUrl | null {
  const fromId = parseSpotifyId(kind, spotifyId)
  if (fromId) {
    return { kind, id: fromId, url: buildSpotifyOpenUrl(kind, fromId) }
  }
  const fromUrl = parseSpotifyId(kind, spotifyUrl)
  if (fromUrl) {
    return { kind, id: fromUrl, url: buildSpotifyOpenUrl(kind, fromUrl) }
  }
  return null
}
