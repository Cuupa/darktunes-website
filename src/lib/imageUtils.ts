/**
 * src/lib/imageUtils.ts
 *
 * Central image proxy utilities for the darkTunes platform.
 *
 * All public-facing images (whether cached in R2 or externally hosted) MUST be
 * served through wsrv.nl, which performs on-the-fly WebP conversion, resizing,
 * and smart CDN caching — preventing origin load and ensuring consistent output.
 *
 * Usage:
 *   <img src={getOptimizedImageUrl(artist.imageUrl, 400)} />
 *   <img src={getSquareThumbnail(release.coverArt, 300)} />
 */

const WSRV_BASE = 'https://wsrv.nl/'

/**
 * Returns a wsrv.nl-proxied URL that serves the image at `width` pixels wide,
 * converted to WebP format.
 *
 * @param url   - Original image URL (e.g. a Cloudflare R2 public URL)
 * @param width - Desired output width in pixels
 * @returns     - wsrv.nl proxy URL, or empty string if `url` is falsy
 */
export function getOptimizedImageUrl(url: string, width: number): string {
  if (!url) return ''
  return `${WSRV_BASE}?url=${encodeURIComponent(url)}&w=${width}&output=webp&maxage=31d`
}

/**
 * Returns a wsrv.nl-proxied URL that crops and resizes the image to a square
 * thumbnail of `size × size` pixels in WebP format.
 *
 * @param url  - Original image URL
 * @param size - Desired square dimension in pixels
 * @returns    - wsrv.nl proxy URL, or empty string if `url` is falsy
 */
export function getSquareThumbnail(url: string, size: number): string {
  if (!url) return ''
  return `${WSRV_BASE}?url=${encodeURIComponent(url)}&w=${size}&h=${size}&fit=cover&output=webp&maxage=31d`
}
