/**
 * WCAG contrast checks for Fan Page theme colors.
 */

export type ContrastLevel = 'pass-aa' | 'pass-aaa' | 'fail'

export interface ContrastResult {
  ratio: number
  level: ContrastLevel
}

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.replace('#', '').trim()
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(normalized)) return null
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

export function getContrastRatio(foreground: string, background: string): number | null {
  const fg = hexToRgb(foreground)
  const bg = hexToRgb(background)
  if (!fg || !bg) return null
  const l1 = relativeLuminance(...fg)
  const l2 = relativeLuminance(...bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function checkContrast(foreground: string, background: string): ContrastResult | null {
  const ratio = getContrastRatio(foreground, background)
  if (ratio === null) return null
  let level: ContrastLevel = 'fail'
  if (ratio >= 7) level = 'pass-aaa'
  else if (ratio >= 4.5) level = 'pass-aa'
  return { ratio, level }
}

export function suggestAccessibleTextColor(background: string): string {
  const bg = hexToRgb(background)
  if (!bg) return '#ffffff'
  const lum = relativeLuminance(...bg)
  return lum > 0.5 ? '#0a0a0a' : '#f5f5f5'
}