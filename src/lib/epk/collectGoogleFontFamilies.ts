import { isGoogleFontFamily, parsePrimaryFontFamily } from '@/lib/epk/googleFonts'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'

export function collectGoogleFontFamilies(document: EpkDocumentV2): string[] {
  const families = new Set<string>()
  for (const font of document.fonts) {
    if (isGoogleFontFamily(font.family)) families.add(font.family)
  }
  for (const el of document.elements) {
    const family = el.style?.fontFamily
    if (!family) continue
    const primary = parsePrimaryFontFamily(family)
    if (isGoogleFontFamily(primary)) families.add(primary)
  }
  return [...families]
}