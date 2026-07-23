/**
 * Normalize artist-provided cover art URLs (esp. Google Drive share links)
 * into a form the server can fetch as raw image bytes.
 */

const DRIVE_FILE_ID_RE =
  /(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=download&)?id=|thumbnail\?id=)([a-zA-Z0-9_-]+)/i

const DRIVE_ID_QUERY_RE = /[?&]id=([a-zA-Z0-9_-]+)/i

/** Hosts allowed for cover-art fetch (SSRF allowlist). */
export const COVER_ART_HOSTNAME_PATTERNS: RegExp[] = [
  /^drive\.google\.com$/,
  /^docs\.google\.com$/,
  /^[^.]+\.googleusercontent\.com$/,
  /^lh\d+\.googleusercontent\.com$/,
  // Cloudflare R2
  /^[^.]+\.r2\.dev$/,
  // Supabase Storage
  /^[^.]+\.supabase\.co$/,
  // Vercel Blob
  /^[^.]+\.public\.blob\.vercel-storage\.com$/,
  /^[^.]+\.blob\.vercel-storage\.com$/,
  // Common CDNs / music hosts
  /^wsrv\.nl$/,
  /^i\.scdn\.co$/,
  /^mosaic\.scdn\.co$/,
  /^image-cdn\.(?:akamaized\.net|spotifycdn\.com)$/,
  /^is\d+-ssl\.mzstatic\.com$/,
  /^[^.]+\.mzstatic\.com$/,
  /^img\.discogs\.com$/,
  /^s\.discogs\.com$/,
  /^i\.ytimg\.com$/,
  /^yt\d\.ggpht\.com$/,
  /^[^.]+\.cloudfront\.net$/,
  /^[^.]+\.akamaized\.net$/,
  /^[^.]+\.fbcdn\.net$/,
  /^[^.]+\.cdninstagram\.com$/,
  // Dropbox share → raw
  /^www\.dropbox\.com$/,
  /^dropbox\.com$/,
  /^dl\.dropboxusercontent\.com$/,
  // WeTransfer / common share hosts artists use for covers
  /^[^.]+\.wetransfer\.com$/,
  /^download\.wetransfer\.com$/,
]

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal', 'metadata.goog'])

export function isPrivateOrLoopbackHost(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(lower)) return true
  if (lower.endsWith('.localhost') || lower.endsWith('.local')) return true

  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(lower)
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number)
    if (octets.some((o) => o > 255)) return true
    const [a, b] = octets
    if (a === 127) return true
    if (a === 10) return true
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    if (a === 0) return true
    return false
  }

  if (lower === '::1') return true
  if (lower.startsWith('fe80:')) return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  return false
}

export function extractGoogleDriveFileId(url: string): string | null {
  const fromPath = DRIVE_FILE_ID_RE.exec(url)
  if (fromPath?.[1]) return fromPath[1]
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host === 'drive.google.com' || host === 'docs.google.com') {
      const fromQuery = DRIVE_ID_QUERY_RE.exec(url)
      if (fromQuery?.[1]) return fromQuery[1]
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Convert share / view URLs into a direct-download style URL when possible.
 * Returns the original URL when no transformation is needed.
 */
export function normalizeCoverArtUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed

  const driveId = extractGoogleDriveFileId(trimmed)
  if (driveId) {
    return `https://drive.google.com/uc?export=download&id=${driveId}`
  }

  try {
    const parsed = new URL(trimmed)
    // Dropbox share links need dl=1 for direct file bytes
    if (
      (parsed.hostname === 'www.dropbox.com' || parsed.hostname === 'dropbox.com') &&
      parsed.searchParams.get('dl') !== '1'
    ) {
      parsed.searchParams.set('dl', '1')
      return parsed.href
    }
  } catch {
    return trimmed
  }

  return trimmed
}

export function isAllowedCoverArtUrl(url: string, r2PublicUrl?: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
  if (isPrivateOrLoopbackHost(parsed.hostname)) return false

  const patterns = [...COVER_ART_HOSTNAME_PATTERNS]
  if (r2PublicUrl) {
    try {
      const hostname = new URL(r2PublicUrl).hostname
      if (hostname && !isPrivateOrLoopbackHost(hostname)) {
        const escaped = hostname.replace(/\./g, '\\.')
        patterns.push(new RegExp(`^${escaped}$`))
      }
    } catch {
      // ignore invalid env
    }
  }

  return patterns.some((re) => re.test(parsed.hostname))
}

export function isJpegMagicBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

export const COVER_ART_REQUIRED_SIZE = 3000

export function isValidCoverArtSize(width: number, height: number): boolean {
  return width === COVER_ART_REQUIRED_SIZE && height === COVER_ART_REQUIRED_SIZE
}
