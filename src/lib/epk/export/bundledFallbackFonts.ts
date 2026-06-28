/**
 * Bundled Noto Sans fallback fonts for PDF export (fully embedded, offline-safe).
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const FONT_DIR = join(process.cwd(), 'node_modules/@fontsource/noto-sans/files')

export const FALLBACK_FONT_FAMILY = 'Noto Sans'

let cached: { regular: Uint8Array; bold: Uint8Array } | null = null

export function loadBundledNotoSans(): { regular: Uint8Array; bold: Uint8Array } {
  if (cached) return cached

  cached = {
    regular: new Uint8Array(
      readFileSync(join(FONT_DIR, 'noto-sans-latin-400-normal.woff2')),
    ),
    bold: new Uint8Array(
      readFileSync(join(FONT_DIR, 'noto-sans-latin-700-normal.woff2')),
    ),
  }

  return cached
}