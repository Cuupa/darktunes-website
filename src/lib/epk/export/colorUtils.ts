/**
 * src/lib/epk/export/colorUtils.ts
 *
 * Converts CSS color strings to pdf-lib rgb() values.
 */

import { rgb, type RGB } from 'pdf-lib'

export function parseColorToRgb(color: string | undefined, fallback: RGB): RGB {
  if (!color) return fallback

  const hex = color.trim()
  if (hex.startsWith('#')) {
    const raw = hex.slice(1)
    const full = raw.length === 3
      ? raw.split('').map((c) => c + c).join('')
      : raw.slice(0, 6)
    const num = parseInt(full, 16)
    if (Number.isNaN(num)) return fallback
    return rgb(
      ((num >> 16) & 255) / 255,
      ((num >> 8) & 255) / 255,
      (num & 255) / 255,
    )
  }

  return fallback
}