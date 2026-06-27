/**
 * Formats a CSS font-family stack for Konva/canvas (quote names with spaces).
 */
export function formatKonvaFontFamily(family?: string): string {
  const stack = family ?? 'Helvetica, Arial, sans-serif'
  return stack
    .split(',')
    .map((part) => {
      const trimmed = part.trim()
      if (!trimmed || /^['"]/.test(trimmed)) return trimmed
      if (trimmed.includes(' ')) return `"${trimmed}"`
      return trimmed
    })
    .join(', ')
}