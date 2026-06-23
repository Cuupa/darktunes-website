/**
 * src/lib/epk/editor/hydrateDocumentFonts.ts
 *
 * Ensures document.fonts entries have public src URLs for canvas preview.
 */

import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'

export interface EpkFontAssetLike {
  id: string
  publicUrl: string
}

export function hydrateDocumentFonts(
  document: EpkDocumentV2,
  fontAssets: EpkFontAssetLike[],
): EpkDocumentV2 {
  if (document.fonts.length === 0) return document

  const byId = new Map(fontAssets.map((font) => [font.id, font.publicUrl]))

  return {
    ...document,
    fonts: document.fonts.map((font) => ({
      ...font,
      src: font.src ?? (font.id ? byId.get(font.id) : undefined),
    })),
  }
}