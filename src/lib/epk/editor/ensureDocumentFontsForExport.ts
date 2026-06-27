/**
 * src/lib/epk/editor/ensureDocumentFontsForExport.ts
 *
 * Hydrates font src/r2Key from DB records and ensures text elements' families
 * are registered before PDF export.
 */

import type { EpkDocumentV2, EpkFont } from '@/lib/epk/schema/documentV2'
import { hydrateDocumentFonts } from './hydrateDocumentFonts'
import { EPK_GOOGLE_FONTS, isGoogleFontFamily } from '@/lib/epk/googleFonts'

export interface EpkFontRecordLike {
  id: string
  name: string
  r2Key: string
  publicUrl: string
}

export function ensureDocumentFontsForExport(
  document: EpkDocumentV2,
  fontRecords: EpkFontRecordLike[],
): EpkDocumentV2 {
  const fontAssets = fontRecords.map((font) => ({
    id: font.id,
    publicUrl: font.publicUrl,
  }))

  let next = hydrateDocumentFonts(document, fontAssets)

  const byId = new Map(fontRecords.map((font) => [font.id, font]))
  const byFamily = new Map(fontRecords.map((font) => [font.name, font]))
  const existing = new Map(next.fonts.map((font) => [font.family, font]))

  const addFont = (font: EpkFont) => {
    if (existing.has(font.family)) return
    existing.set(font.family, font)
    next = { ...next, fonts: [...next.fonts, font] }
  }

  for (const font of next.fonts) {
    const record = (font.id ? byId.get(font.id) : undefined) ?? byFamily.get(font.family)
    if (!record) continue
    if (!font.src || !font.r2Key) {
      const index = next.fonts.findIndex((f) => f.id === font.id)
      if (index === -1) continue
      const patched = [...next.fonts]
      patched[index] = {
        ...font,
        src: font.src ?? record.publicUrl,
        r2Key: font.r2Key ?? record.r2Key,
      }
      next = { ...next, fonts: patched }
      existing.set(font.family, patched[index]!)
    }
  }

  for (const element of next.elements) {
    if (element.type !== 'text') continue
    const family = element.style.fontFamily
    if (!family || family === 'Helvetica, Arial, sans-serif') continue
    if (existing.has(family)) continue

    const custom = byFamily.get(family)
    if (custom) {
      addFont({
        id: custom.id,
        family: custom.name,
        src: custom.publicUrl,
        r2Key: custom.r2Key,
      })
      continue
    }

    if (isGoogleFontFamily(family)) {
      const spec = EPK_GOOGLE_FONTS.find((f) => f.family === family)
      if (spec) {
        addFont({ id: `google-${spec.id}`, family: spec.family })
      }
    }
  }

  return next
}