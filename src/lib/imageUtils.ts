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

/**
 * Rewrites every `<img src="...">` in an HTML string so that images are served
 * through wsrv.nl at a capped width (default: 800 px) in WebP format.
 *
 * Designed for use with rich-text content authored in TipTap or similar editors
 * (news posts, about page body) where images may be full-resolution originals.
 * Already-proxied wsrv.nl URLs are left untouched to avoid double-encoding.
 *
 * @param html  - Raw HTML string (should already be DOMPurify-sanitised)
 * @param width - Max output width in pixels (default: 800)
 * @returns     - HTML string with optimised image src attributes
 */
export function processHtmlImages(html: string, width = 800): string {
  if (!html) return html
  // Replace src attributes that are NOT already pointing at wsrv.nl
  return html.replace(
    /(<img\b[^>]*?\bsrc=")([^"]+)(")/gi,
    (match, before, src, after) => {
      if (src.startsWith('https://wsrv.nl') || src.startsWith('data:')) return match
      return `${before}${getOptimizedImageUrl(src, width)}${after}`
    },
  )
}
