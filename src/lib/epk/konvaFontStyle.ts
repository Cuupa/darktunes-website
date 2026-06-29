/**
 * Shared Konva/pdf font style helpers for EPK canvas + PDF export parity.
 */

import type { EpkElementStyle } from '@/lib/epk/schema/documentV2'
import { resolveFontWeight } from '@/lib/epk/fontFamily'

export function isItalicFontStyle(fontStyle?: EpkElementStyle['fontStyle']): boolean {
  return fontStyle?.includes('italic') ?? false
}

/** Konva Text fontStyle string (normal | bold | italic | italic bold). */
export function resolveKonvaFontStyle(style: Pick<EpkElementStyle, 'fontWeight' | 'fontStyle'>): string {
  const weight = resolveFontWeight(style.fontWeight)
  const italic = isItalicFontStyle(style.fontStyle)

  if (weight >= 700 && italic) return 'italic bold'
  if (weight >= 700) return 'bold'
  if (italic) return 'italic'
  return 'normal'
}