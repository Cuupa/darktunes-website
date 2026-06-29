/**
 * Bundled Noto Sans fallback fonts for PDF export (offline-safe).
 * Fonts are vendored under src/lib/epk/export/assets/fonts so Vercel serverless traces include them.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FALLBACK_FONT_FAMILY } from '@/lib/epk/fontFamily'


export { FALLBACK_FONT_FAMILY }

const FONT_DIR = join(process.cwd(), 'src/lib/epk/export/assets/fonts')

let cached: { regular: Uint8Array; bold: Uint8Array } | null = null

export function loadBundledNotoSans(): { regular: Uint8Array; bold: Uint8Array } {
  if (cached) return cached

  cached = {
    regular: new Uint8Array(
      readFileSync(join(FONT_DIR, 'noto-sans-latin-ext-400-normal.woff2')),
    ),
    bold: new Uint8Array(
      readFileSync(join(FONT_DIR, 'noto-sans-latin-ext-700-normal.woff2')),
    ),
  }

  return cached
}