/**
 * src/lib/epk/epkImageProxy.ts
 *
 * Shared helpers for EPK PDF image proxying — used by both the API route
 * (server-side SSRF allowlist) and the client-side PDF renderer (URL building
 * + optional base64 pre-fetch).
 */

/** Path for the authenticated portal image proxy route. */
export const EPK_PROXY_IMAGE_PATH = '/api/portal/proxy-image'

/**
 * Static hostname patterns permitted by the EPK image proxy.
 * Covers common music/media CDNs plus storage providers.
 */
export const EPK_IMAGE_HOSTNAME_PATTERNS: RegExp[] = [
  // Cloudflare R2 (default public bucket domain + custom CDN is added dynamically)
  /^[^.]+\.r2\.dev$/,
  // Supabase Storage
  /^[^.]+\.supabase\.co$/,
  // Vercel Blob Storage
  /^[^.]+\.public\.blob\.vercel-storage\.com$/,
  /^[^.]+\.blob\.vercel-storage\.com$/,
  // wsrv.nl image optimiser (used across the public site)
  /^wsrv\.nl$/,
  // Spotify
  /^i\.scdn\.co$/,
  /^mosaic\.scdn\.co$/,
  /^image-cdn\.(?:akamaized\.net|spotifycdn\.com)$/,
  // Apple Music / iTunes
  /^is\d+-ssl\.mzstatic\.com$/,
  /^[^.]+\.mzstatic\.com$/,
  // Discogs
  /^img\.discogs\.com$/,
  /^s\.discogs\.com$/,
  // YouTube thumbnails
  /^i\.ytimg\.com$/,
  /^yt\d\.ggpht\.com$/,
  // Generic CDNs often used for artist imagery
  /^[^.]+\.cloudfront\.net$/,
  /^[^.]+\.akamaized\.net$/,
  /^[^.]+\.googleusercontent\.com$/,
  /^[^.]+\.fbcdn\.net$/,
  /^[^.]+\.cdninstagram\.com$/,
]

/** Hostnames that must never be proxied (SSRF blocklist). */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
])

/**
 * Returns true when `hostname` resolves to a private (RFC 1918 / loopback) IPv4
 * address or a link-local / unique-local IPv6 address.
 */
export function isPrivateOrLoopbackHost(hostname: string): boolean {
  const lower = hostname.toLowerCase()

  if (BLOCKED_HOSTNAMES.has(lower)) return true
  if (lower.endsWith('.localhost') || lower.endsWith('.local')) return true

  // IPv4 loopback + private ranges
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(lower)
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number)
    if (octets.some((o) => o > 255)) return true
    const [a, b] = octets
    if (a === 127) return true
    if (a === 10) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    if (a === 0) return true
    return false
  }

  // IPv6 loopback / link-local / unique-local
  if (lower === '::1') return true
  if (lower.startsWith('fe80:')) return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true

  return false
}

/**
 * Builds the full list of allowed hostname patterns, optionally including the
 * custom R2 CDN hostname from `CLOUDFLARE_R2_PUBLIC_URL`.
 */
export function buildEpkImageHostnamePatterns(r2PublicUrl?: string): RegExp[] {
  const patterns = [...EPK_IMAGE_HOSTNAME_PATTERNS]

  if (r2PublicUrl) {
    try {
      const hostname = new URL(r2PublicUrl).hostname
      if (hostname && !isPrivateOrLoopbackHost(hostname)) {
        const escaped = hostname.replace(/\./g, '\\.')
        patterns.push(new RegExp(`^${escaped}$`))
      }
    } catch {
      // Ignore invalid env URL — static patterns still apply.
    }
  }

  return patterns
}

/**
 * Returns true when the given absolute image URL may be fetched by the proxy.
 * Pass `r2PublicUrl` (from CLOUDFLARE_R2_PUBLIC_URL) to allow the custom CDN hostname.
 */
export function isAllowedEpkImageUrl(url: string, r2PublicUrl?: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
  if (isPrivateOrLoopbackHost(parsed.hostname)) return false

  const patterns = buildEpkImageHostnamePatterns(r2PublicUrl)
  return patterns.some((re) => re.test(parsed.hostname))
}

/**
 * Builds an absolute proxy URL for @react-pdf/renderer image fetches.
 * Relative paths and `data:` URIs are returned unchanged.
 */
/**
 * Resolves an image URL for Konva canvas rendering in the authenticated portal.
 * Remote assets are routed through the portal proxy so R2 CORS restrictions do not
 * block `HTMLImageElement` loads used by react-konva.
 */
export function resolveEpkCanvasImageSrc(src: string): string {
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return src

  if (typeof window === 'undefined') return src

  try {
    const parsed = new URL(src, window.location.origin)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return buildEpkProxyImageUrl(parsed.href, window.location.origin)
    }
  } catch {
    // Relative or invalid URL — return unchanged.
  }

  return src
}

export function buildEpkProxyImageUrl(
  url: string,
  origin: string,
): string {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url

  try {
    const parsed = new URL(url, origin)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      const absolute = parsed.href
      return `${origin}${EPK_PROXY_IMAGE_PATH}?url=${encodeURIComponent(absolute)}`
    }
  } catch {
    // Not an absolute URL — return as-is (e.g. relative path).
  }

  return url
}

/**
 * Converts a Blob to a base64 data URI suitable for @react-pdf/renderer.
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  const base64 = btoa(binary)
  const mime = blob.type || 'image/jpeg'
  return `data:${mime};base64,${base64}`
}

/**
 * Fetches an image through the portal proxy and returns a base64 data URI.
 * Returns `undefined` when the fetch fails so the PDF can render without the image.
 */
export async function fetchEpkImageAsDataUrl(
  url: string | undefined,
  origin: string,
  fetchFn: typeof fetch = fetch,
): Promise<string | undefined> {
  if (!url) return undefined
  if (url.startsWith('data:')) return url

  try {
    const proxyUrl = buildEpkProxyImageUrl(url, origin)
    const res = await fetchFn(proxyUrl, { credentials: 'include' })
    if (!res.ok) return undefined
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) return undefined
    return blobToDataUrl(await res.blob())
  } catch {
    return undefined
  }
}