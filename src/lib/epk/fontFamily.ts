/**
 * Shared font-family helpers for EPK canvas preview and PDF export.
 */

export const FALLBACK_FONT_FAMILY = 'Noto Sans'
export const DEFAULT_FONT_STACK = 'Helvetica, Arial, sans-serif'

const GENERIC_FAMILIES = new Set([
  'sans-serif',
  'serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
])

const SYSTEM_FALLBACKS = new Set(['helvetica', 'arial', 'georgia', 'times new roman', 'times'])

/**
 * Resolves the primary font from a CSS font-family stack for font lookup and embedding.
 */
export function parsePrimaryFontFamily(family?: string): string {
  if (!family?.trim()) return FALLBACK_FONT_FAMILY

  for (const part of family.split(',')) {
    const trimmed = part.trim().replace(/^['"]|['"]$/g, '')
    if (!trimmed) continue

    const lower = trimmed.toLowerCase()
    if (GENERIC_FAMILIES.has(lower)) continue
    if (SYSTEM_FALLBACKS.has(lower)) return FALLBACK_FONT_FAMILY

    return trimmed
  }

  return FALLBACK_FONT_FAMILY
}

/**
 * Maps element fontWeight to an embeddable weight bucket (400, 600, or 700).
 */
export function resolveFontWeight(fontWeight?: number | string): number {
  if (fontWeight === 'bold') return 700
  const numeric =
    typeof fontWeight === 'number' ? fontWeight : Number.parseInt(String(fontWeight), 10)
  if (!Number.isFinite(numeric)) return 400
  if (numeric >= 700) return 700
  if (numeric >= 600) return 600
  return 400
}

export function isBoldFontWeight(fontWeight?: number | string): boolean {
  return resolveFontWeight(fontWeight) >= 700
}