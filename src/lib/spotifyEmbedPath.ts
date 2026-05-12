const DEFAULT_SPOTIFY_PLAYLIST_ID = '37i9dQZF1DWWqNV5cS50j6'

/**
 * Converts a Spotify URL/URI/bare ID to an embed-ready path.
 */
export function getSpotifyEmbedPath(uri: string): string {
  if (!uri) return `/playlist/${DEFAULT_SPOTIFY_PLAYLIST_ID}`

  try {
    const url = new URL(uri)
    if (url.hostname === 'open.spotify.com' || url.hostname.endsWith('.spotify.com')) {
      return url.pathname
    }
  } catch {
    // Not a URL; continue with Spotify URI / bare ID parsing.
  }

  const parts = uri.split(':')
  if (parts.length === 3) return `/${parts[1]}/${parts[2]}`

  const trimmed = uri.trim()
  if (/^[A-Za-z0-9]{22}$/.test(trimmed)) return `/playlist/${trimmed}`

  return `/playlist/${DEFAULT_SPOTIFY_PLAYLIST_ID}`
}
