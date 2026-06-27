/**
 * Fetches Google Font WOFF2 bytes for PDF embedding.
 */

export async function fetchGoogleFontBytes(
  family: string,
  weight = 400,
): Promise<Uint8Array | null> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`

  try {
    const cssRes = await fetch(cssUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(12_000),
    })
    if (!cssRes.ok) return null

    const css = await cssRes.text()
    const match = css.match(/src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)\s*format\('woff2'\)/)
    if (!match?.[1]) return null

    const fontRes = await fetch(match[1], { signal: AbortSignal.timeout(12_000) })
    if (!fontRes.ok) return null

    return new Uint8Array(await fontRes.arrayBuffer())
  } catch {
    return null
  }
}