/**
 * src/lib/parsers/platformUrlParser.ts
 *
 * Centralized platform URL/ID parser.
 *
 * Extracts bare IDs from any URL format for the following platforms:
 *   - Spotify (artist, album, track, playlist)
 *   - YouTube (channel, handle, video)
 *   - Discogs (artist, release)
 *   - Apple Music / iTunes (artist, album)
 *   - Amazon Music
 *   - Deezer
 *
 * All parse functions accept either a full URL or a bare ID and return the
 * normalised ID string, or `null` if the input cannot be parsed.
 */

// ---------------------------------------------------------------------------
// Spotify
// ---------------------------------------------------------------------------

/**
 * Extracts a Spotify artist ID from:
 *   - https://open.spotify.com/artist/xxx
 *   - https://open.spotify.com/intl-de/artist/xxx
 *   - https://spotify.com/artist/xxx
 *   - spotify:artist:xxx
 *   - Bare alphanumeric ID
 */
export function extractSpotifyArtistId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Bare ID (22 alphanumeric chars is typical, but we accept any non-URL alphanumeric string)
  if (/^[A-Za-z0-9]+$/.test(trimmed)) return trimmed

  // Spotify URI: spotify:artist:xxx
  const uriParts = trimmed.split(':')
  if (uriParts.length === 3 && uriParts[0] === 'spotify' && uriParts[1] === 'artist') {
    return uriParts[2]
  }

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    if (!url.hostname.includes('spotify.com')) return null

    const parts = url.pathname.split('/').filter(Boolean)
    // Handle /intl-de/artist/xxx and /artist/xxx
    const artistIndex = parts.findIndex((p) => p === 'artist')
    if (
      artistIndex !== -1 &&
      parts[artistIndex + 1] &&
      /^[A-Za-z0-9]+$/.test(parts[artistIndex + 1])
    ) {
      return parts[artistIndex + 1]
    }
  } catch {
    return null
  }

  return null
}

/**
 * Extracts a Spotify resource ID from any Spotify URL or URI.
 * Returns { type, id } where type is 'artist' | 'album' | 'track' | 'playlist' | 'show' | 'episode'.
 */
export function parseSpotifyUrl(
  input: string,
): { type: string; id: string } | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Spotify URI: spotify:type:id
  const uriParts = trimmed.split(':')
  if (uriParts.length === 3 && uriParts[0] === 'spotify') {
    return { type: uriParts[1], id: uriParts[2] }
  }

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    if (!url.hostname.includes('spotify.com')) return null

    const parts = url.pathname.split('/').filter(Boolean)
    // Find the first recognized resource type segment
    const types = ['artist', 'album', 'track', 'playlist', 'show', 'episode']
    const typeIndex = parts.findIndex((p) => types.includes(p))
    if (typeIndex !== -1 && parts[typeIndex + 1]) {
      return { type: parts[typeIndex], id: parts[typeIndex + 1] }
    }
  } catch {
    return null
  }

  return null
}

// ---------------------------------------------------------------------------
// YouTube
// ---------------------------------------------------------------------------

/**
 * Extracts a YouTube channel ID (UC...) or handle from:
 *   - https://www.youtube.com/channel/UCxxx
 *   - https://www.youtube.com/@handle
 *   - https://youtube.com/c/channelname
 *   - https://youtube.com/user/username
 *   - Bare UC... channel ID
 */
export function extractYouTubeChannelId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Bare channel ID (starts with UC)
  if (/^UC[A-Za-z0-9_-]{22}$/.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    if (
      !url.hostname.includes('youtube.com') &&
      !url.hostname.includes('youtu.be')
    ) {
      return null
    }

    const parts = url.pathname.split('/').filter(Boolean)

    // /channel/UCxxx
    if (parts[0] === 'channel' && parts[1]) return parts[1]

    // /@handle or /c/channelname or /user/username
    if (parts[0] === '@' || (parts[0] && parts[0].startsWith('@')))
      return parts[0] // Return the @handle as-is

    if ((parts[0] === 'c' || parts[0] === 'user') && parts[1]) return parts[1]
  } catch {
    return null
  }

  return null
}

/**
 * Extracts a YouTube video ID (11-char alphanumeric) from:
 *   - https://www.youtube.com/watch?v=ID
 *   - https://youtu.be/ID
 *   - https://www.youtube.com/embed/ID
 *   - https://www.youtube.com/shorts/ID
 *   - https://www.youtube.com/v/ID
 *   - Bare 11-char ID
 */
export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Bare video ID (11 chars)
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)

    // youtu.be/ID
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.slice(1).split('/')[0]
      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return id
    }

    if (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') {
      // watch?v=ID
      if (url.pathname === '/watch') {
        const v = url.searchParams.get('v')
        if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v
      }

      // /embed/ID, /v/ID, /shorts/ID
      const parts = url.pathname.split('/').filter(Boolean)
      if (['embed', 'v', 'shorts'].includes(parts[0]) && parts[1]) {
        const id = parts[1].split('?')[0]
        if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id
      }
    }
  } catch {
    return null
  }

  return null
}

// ---------------------------------------------------------------------------
// Discogs
// ---------------------------------------------------------------------------

/**
 * Extracts a Discogs artist ID from:
 *   - https://www.discogs.com/artist/12345
 *   - https://www.discogs.com/de/artist/12345
 *   - Bare numeric ID
 */
export function extractDiscogsArtistId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Bare numeric ID
  if (/^\d+$/.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    if (!url.hostname.includes('discogs.com')) return null

    const parts = url.pathname.split('/').filter(Boolean)
    // Find 'artist' segment (handles /de/artist/12345 and /artist/12345)
    const artistIndex = parts.findIndex((p) => p === 'artist')
    if (artistIndex !== -1 && parts[artistIndex + 1] && /^\d+/.test(parts[artistIndex + 1])) {
      // Strip any trailing name slug (e.g. "12345-Artist-Name")
      return parts[artistIndex + 1].split('-')[0]
    }
  } catch {
    return null
  }

  return null
}

/**
 * Extracts a Discogs release ID from:
 *   - https://www.discogs.com/release/12345
 *   - https://www.discogs.com/de/release/12345
 *   - Bare numeric ID
 */
export function extractDiscogsReleaseId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (/^\d+$/.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    if (!url.hostname.includes('discogs.com')) return null

    const parts = url.pathname.split('/').filter(Boolean)
    const releaseIndex = parts.findIndex((p) => p === 'release' || p === 'master')
    if (releaseIndex !== -1 && parts[releaseIndex + 1] && /^\d+/.test(parts[releaseIndex + 1])) {
      return parts[releaseIndex + 1].split('-')[0]
    }
  } catch {
    return null
  }

  return null
}

// ---------------------------------------------------------------------------
// Apple Music / iTunes
// ---------------------------------------------------------------------------

/**
 * Extracts an Apple Music artist ID from:
 *   - https://music.apple.com/de/artist/name/12345
 *   - https://itunes.apple.com/de/artist/name/id12345
 *   - Various regional store URLs (/de/, /us/, etc.)
 *   - Bare numeric ID
 */
export function extractAppleMusicArtistId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (/^\d+$/.test(trimmed)) return trimmed
  // Prefixed with 'id': id12345
  if (/^id\d+$/i.test(trimmed)) return trimmed.replace(/^id/i, '')

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    if (!url.hostname.includes('apple.com')) return null

    const parts = url.pathname.split('/').filter(Boolean)
    // /de/artist/name/12345 or /us/artist/name/id12345
    const artistIndex = parts.findIndex((p) => p === 'artist')
    if (artistIndex !== -1) {
      // ID is the last numeric segment
      for (let i = parts.length - 1; i > artistIndex; i--) {
        const cleaned = parts[i].replace(/^id/i, '')
        if (/^\d+$/.test(cleaned)) return cleaned
      }
    }
  } catch {
    return null
  }

  return null
}

// ---------------------------------------------------------------------------
// Deezer
// ---------------------------------------------------------------------------

/**
 * Extracts a Deezer artist ID from:
 *   - https://www.deezer.com/artist/12345
 *   - https://www.deezer.com/de/artist/12345
 *   - Bare numeric ID
 */
export function extractDeezerArtistId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (/^\d+$/.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    if (!url.hostname.includes('deezer.com')) return null

    const parts = url.pathname.split('/').filter(Boolean)
    const artistIndex = parts.findIndex((p) => p === 'artist')
    if (artistIndex !== -1 && parts[artistIndex + 1] && /^\d+$/.test(parts[artistIndex + 1])) {
      return parts[artistIndex + 1]
    }
  } catch {
    return null
  }

  return null
}

// ---------------------------------------------------------------------------
// Amazon Music
// ---------------------------------------------------------------------------

/**
 * Extracts an Amazon Music artist ASIN from:
 *   - https://music.amazon.com/artists/B0xxx
 *   - https://www.amazon.de/music/player/artists/B0xxx
 *   - Bare ASIN (alphanumeric, typically starts with B0)
 */
export function extractAmazonMusicArtistId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Bare ASIN
  if (/^[A-Z0-9]{10}$/.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    if (
      !url.hostname.includes('amazon.') &&
      !url.hostname.includes('music.amazon')
    ) {
      return null
    }

    const parts = url.pathname.split('/').filter(Boolean)
    const artistIndex = parts.findIndex((p) => p === 'artists')
    if (artistIndex !== -1 && parts[artistIndex + 1]) {
      return parts[artistIndex + 1]
    }
  } catch {
    return null
  }

  return null
}
