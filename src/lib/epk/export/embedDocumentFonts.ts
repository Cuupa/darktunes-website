/**
 * src/lib/epk/export/embedDocumentFonts.ts
 *
 * Embeds custom document fonts into a pdf-lib PDFDocument via fontkit.
 */

import fontkit from 'fontkit'
import type { PDFDocument, PDFFont } from 'pdf-lib'
import { StandardFonts } from 'pdf-lib'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import { buildEpkFontPublicUrl } from '@/lib/api/epkFonts'
import { fetchRemoteBytes } from './fetchRemoteBytes'
import { fetchGoogleFontBytes } from './fetchGoogleFontBytes'
import { isGoogleFontFamily } from '@/lib/epk/googleFonts'

export interface PdfFontSet {
  regular: PDFFont
  bold: PDFFont
  byFamily: Map<string, PDFFont>
}

export async function embedDocumentFonts(
  pdfDoc: PDFDocument,
  document: EpkDocumentV2,
  r2PublicUrl?: string,
): Promise<PdfFontSet> {
  pdfDoc.registerFontkit(fontkit)

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const byFamily = new Map<string, PDFFont>([
    ['Helvetica, Arial, sans-serif', regular],
    ['Helvetica', regular],
  ])

  for (const font of document.fonts) {
    let bytes: Uint8Array | null = null

    if (isGoogleFontFamily(font.family)) {
      bytes = await fetchGoogleFontBytes(font.family, 400)
    } else {
      const url =
        font.src ??
        (font.r2Key && r2PublicUrl ? buildEpkFontPublicUrl(font.r2Key, r2PublicUrl) : undefined)
      if (url) bytes = await fetchRemoteBytes(url, r2PublicUrl)
    }

    if (!bytes) continue

    try {
      const embedded = await pdfDoc.embedFont(bytes)
      byFamily.set(font.family, embedded)
    } catch {
      // Skip unsupported or corrupt font files.
    }
  }

  for (const element of document.elements) {
    if (element.type !== 'text' || !element.style.fontFamily) continue
    const family = element.style.fontFamily
    if (byFamily.has(family) || !isGoogleFontFamily(family)) continue
    const bytes = await fetchGoogleFontBytes(family, 400)
    if (!bytes) continue
    try {
      byFamily.set(family, await pdfDoc.embedFont(bytes))
    } catch {
      // fallback to Helvetica via resolvePdfFont
    }
  }

  return { regular, bold, byFamily }
}

export function resolvePdfFont(fonts: PdfFontSet, style: { fontFamily?: string; fontWeight?: number | string }): PDFFont {
  const family = style.fontFamily
  if (family) {
    const custom = fonts.byFamily.get(family)
    if (custom) return custom
  }

  const weight = style.fontWeight
  if (weight === 700 || weight === 'bold' || weight === 600) {
    return fonts.bold
  }
  return fonts.regular
}