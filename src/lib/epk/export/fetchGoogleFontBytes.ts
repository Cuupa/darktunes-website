/**
 * Fetches Google Font bytes for PDF embedding (TTF preferred, WOFF2 fallback).
 */

const MODERN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const LEGACY_UA = 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)'

const FONT_URL_PATTERN =
  /src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)\s*format\('([^']+)'\)/g

function extractFontUrl(css: string, preferredFormats: string[]): string | null {
  const matches = [...css.matchAll(FONT_URL_PATTERN)]
  for (const format of preferredFormats) {
    const hit = matches.find((match) => match[2] === format)
    if (hit?.[1]) return hit[1]
  }
  return matches[0]?.[1] ?? null
}

async function fetchFontCss(family: string, axis: string, userAgent: string): Promise<string | null> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:${axis}&display=swap`

  try {
    const cssRes = await fetch(cssUrl, {
      headers: { 'User-Agent': userAgent },
      signal: AbortSignal.timeout(12_000),
    })
    if (!cssRes.ok) return null
    return cssRes.text()
  } catch {
    return null
  }
}

async function downloadFontBytes(url: string): Promise<Uint8Array | null> {
  try {
    const fontRes = await fetch(url, { signal: AbortSignal.timeout(12_000) })
    if (!fontRes.ok) return null
    return new Uint8Array(await fontRes.arrayBuffer())
  } catch {
    return null
  }
}

export interface FetchGoogleFontOptions {
  italic?: boolean
}

export async function fetchGoogleFontBytes(
  family: string,
  weight = 400,
  options: FetchGoogleFontOptions = {},
): Promise<Uint8Array | null> {
  const italic = options.italic ?? false
  const axis = italic ? `ital,wght@1,${weight}` : `wght@${weight}`

  const legacyCss = await fetchFontCss(family, axis, LEGACY_UA)
  if (legacyCss) {
    const legacyUrl = extractFontUrl(legacyCss, ['truetype', 'woff', 'woff2'])
    if (legacyUrl) {
      const bytes = await downloadFontBytes(legacyUrl)
      if (bytes) return bytes
    }
  }

  const modernCss = await fetchFontCss(family, axis, MODERN_UA)
  if (!modernCss) return null

  const modernUrl = extractFontUrl(modernCss, ['woff2', 'truetype', 'woff'])
  if (!modernUrl) return null

  return downloadFontBytes(modernUrl)
}