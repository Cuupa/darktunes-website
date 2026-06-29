/**
 * src/lib/epk/export/colorUtils.ts
 *
 * Converts CSS color strings to pdf-lib rgb() values.
 */

import { rgb, type RGB } from 'pdf-lib'

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function parseRgbChannel(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed.endsWith('%')) {
    const percent = Number.parseFloat(trimmed.slice(0, -1))
    return Number.isFinite(percent) ? clamp01(percent / 100) : null
  }
  const numeric = Number.parseFloat(trimmed)
  if (!Number.isFinite(numeric)) return null
  return clamp01(numeric > 1 ? numeric / 255 : numeric)
}

function parseHexColor(color: string, fallback: RGB): RGB {
  const raw = color.slice(1)
  const full =
    raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.slice(0, 6)
  const num = Number.parseInt(full, 16)
  if (Number.isNaN(num)) return fallback
  return rgb(
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  )
}

function parseFunctionalColor(color: string): RGB | null {
  const match = color
    .trim()
    .match(/^rgba?\(\s*([^)]+)\)$/i)
  if (!match?.[1]) return null

  const parts = match[1].split(',').map((part) => part.trim())
  if (parts.length < 3) return null

  const r = parseRgbChannel(parts[0]!)
  const g = parseRgbChannel(parts[1]!)
  const b = parseRgbChannel(parts[2]!)
  if (r === null || g === null || b === null) return null

  return rgb(r, g, b)
}

export function parseColorToRgb(color: string | undefined, fallback: RGB): RGB {
  if (!color) return fallback

  const trimmed = color.trim()
  if (trimmed.startsWith('#')) return parseHexColor(trimmed, fallback)

  return parseFunctionalColor(trimmed) ?? fallback
}

export function parseColorOpacity(color: string | undefined): number {
  if (!color) return 1

  const trimmed = color.trim()
  if (trimmed.startsWith('#') && trimmed.length >= 9) {
    const alpha = Number.parseInt(trimmed.slice(7, 9), 16)
    return Number.isNaN(alpha) ? 1 : clamp01(alpha / 255)
  }

  const match = trimmed.match(/^rgba\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([^)]+)\)$/i)
  if (!match?.[1]) return 1

  const alpha = parseRgbChannel(match[1])
  return alpha ?? 1
}