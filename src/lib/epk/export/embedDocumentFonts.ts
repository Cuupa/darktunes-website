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
    const url =
      font.src ??
      (font.r2Key && r2PublicUrl ? buildEpkFontPublicUrl(font.r2Key, r2PublicUrl) : undefined)
    if (!url) continue

    const bytes = await fetchRemoteBytes(url, r2PublicUrl)
    if (!bytes) continue

    try {
      const embedded = await pdfDoc.embedFont(bytes)
      byFamily.set(font.family, embedded)
    } catch {
      // Skip unsupported or corrupt font files.
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