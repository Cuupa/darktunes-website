/**
 * src/lib/epk/export/embedDocumentFonts.ts
 *
 * Embeds custom document fonts into a pdf-lib PDFDocument via fontkit.
 * Uses @pdf-lib/fontkit with subset embedding so FontFile2 streams contain valid SFNT bytes.
 */

import fontkit from '@pdf-lib/fontkit'
import type { PDFDocument, PDFFont } from 'pdf-lib'
import type { EpkDocumentV2, EpkElementStyle } from '@/lib/epk/schema/documentV2'
import { buildEpkFontPublicUrl } from '@/lib/api/epkFonts'
import { fetchRemoteBytes } from './fetchRemoteBytes'
import { fetchGoogleFontBytes } from './fetchGoogleFontBytes'
import { isGoogleFontFamily } from '@/lib/epk/googleFonts'
import { isItalicFontStyle } from '@/lib/epk/konvaFontStyle'
import {
  FALLBACK_FONT_FAMILY,
  parsePrimaryFontFamily,
  resolveFontWeight,
} from '@/lib/epk/fontFamily'
import { loadBundledNotoSans } from './bundledFallbackFonts'

export interface PdfFontSet {
  fallbackRegular: PDFFont
  fallbackBold: PDFFont
  byKey: Map<string, PDFFont>
}

export function fontCacheKey(family: string, weight: number, italic = false): string {
  return `${family}:${weight}${italic ? ':italic' : ''}`
}

export { isBoldFontWeight, resolveFontWeight } from '@/lib/epk/fontFamily'

interface RequestedFontVariant {
  weight: number
  italic: boolean
}

async function embedFontBytes(
  pdfDoc: PDFDocument,
  byKey: Map<string, PDFFont>,
  family: string,
  weight: number,
  bytes: Uint8Array | null,
  italic = false,
): Promise<void> {
  if (!bytes) return
  const key = fontCacheKey(family, weight, italic)
  if (byKey.has(key)) return

  try {
    const embedded = await pdfDoc.embedFont(bytes, { subset: true })
    byKey.set(key, embedded)
  } catch {
    // Skip unsupported or corrupt font files.
  }
}

async function embedGoogleFamily(
  pdfDoc: PDFDocument,
  byKey: Map<string, PDFFont>,
  family: string,
  variants: RequestedFontVariant[],
): Promise<void> {
  const seen = new Set<string>()
  for (const variant of variants) {
    const dedupeKey = fontCacheKey(family, variant.weight, variant.italic)
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const bytes = await fetchGoogleFontBytes(family, variant.weight, { italic: variant.italic })
    await embedFontBytes(pdfDoc, byKey, family, variant.weight, bytes, variant.italic)
  }
}

function collectRequestedVariants(document: EpkDocumentV2): Map<string, RequestedFontVariant[]> {
  const requested = new Map<string, Map<string, RequestedFontVariant>>()

  const addVariant = (family: string, weight: number, italic: boolean) => {
    const variants = requested.get(family) ?? new Map<string, RequestedFontVariant>()
    const key = fontCacheKey(family, weight, italic)
    variants.set(key, { weight, italic })
    requested.set(family, variants)
  }

  for (const font of document.fonts) {
    const family = parsePrimaryFontFamily(font.family)
    addVariant(family, 400, false)
    addVariant(family, 600, false)
    addVariant(family, 700, false)
    addVariant(family, 400, true)
    addVariant(family, 700, true)
  }

  for (const element of document.elements) {
    if (element.type !== 'text') continue
    const family = parsePrimaryFontFamily(element.style.fontFamily)
    const weight = resolveFontWeight(element.style.fontWeight)
    const italic = isItalicFontStyle(element.style.fontStyle)
    addVariant(family, 400, false)
    if (weight !== 400 || italic) addVariant(family, weight, italic)
  }

  const output = new Map<string, RequestedFontVariant[]>()
  for (const [family, variants] of requested) {
    output.set(family, [...variants.values()])
  }
  return output
}

export async function embedDocumentFonts(
  pdfDoc: PDFDocument,
  document: EpkDocumentV2,
  r2PublicUrl?: string,
): Promise<PdfFontSet> {
  pdfDoc.registerFontkit(fontkit)
  const byKey = new Map<string, PDFFont>()

  const bundled = loadBundledNotoSans()
  const fallbackRegular = await pdfDoc.embedFont(bundled.regular, { subset: true })
  const fallbackBold = await pdfDoc.embedFont(bundled.bold, { subset: true })

  const registerFallbackAliases = (regular: PDFFont, bold: PDFFont) => {
    for (const family of [FALLBACK_FONT_FAMILY, 'Helvetica, Arial, sans-serif', 'Helvetica']) {
      byKey.set(fontCacheKey(family, 400), regular)
      byKey.set(fontCacheKey(family, 600), regular)
      byKey.set(fontCacheKey(family, 700), bold)
      byKey.set(fontCacheKey(family, 400, true), regular)
      byKey.set(fontCacheKey(family, 600, true), regular)
      byKey.set(fontCacheKey(family, 700, true), bold)
    }
  }

  registerFallbackAliases(fallbackRegular, fallbackBold)

  for (const font of document.fonts) {
    const family = parsePrimaryFontFamily(font.family)

    if (isGoogleFontFamily(family)) {
      await embedGoogleFamily(pdfDoc, byKey, family, [
        { weight: 400, italic: false },
        { weight: 600, italic: false },
        { weight: 700, italic: false },
        { weight: 400, italic: true },
        { weight: 700, italic: true },
      ])
      continue
    }

    const url =
      font.src ??
      (font.r2Key && r2PublicUrl ? buildEpkFontPublicUrl(font.r2Key, r2PublicUrl) : undefined)
    const bytes = url ? await fetchRemoteBytes(url, r2PublicUrl) : null
    await embedFontBytes(pdfDoc, byKey, family, 400, bytes)
    await embedFontBytes(pdfDoc, byKey, family, 700, bytes)
  }

  const requested = collectRequestedVariants(document)
  for (const [family, variants] of requested) {
    if (!isGoogleFontFamily(family)) continue
    await embedGoogleFamily(pdfDoc, byKey, family, variants)
  }

  return { fallbackRegular, fallbackBold, byKey }
}

export function resolvePdfFont(
  fonts: PdfFontSet,
  style: Pick<EpkElementStyle, 'fontFamily' | 'fontWeight' | 'fontStyle'>,
): PDFFont {
  const family = parsePrimaryFontFamily(style.fontFamily)
  const weight = resolveFontWeight(style.fontWeight)
  const italic = isItalicFontStyle(style.fontStyle)
  const preferredKey = fontCacheKey(family, weight, italic)
  const uprightKey = fontCacheKey(family, weight, false)
  const regularKey = fontCacheKey(family, 400, italic)
  const regularUprightKey = fontCacheKey(family, 400, false)
  const boldKey = fontCacheKey(family, 700, italic)
  const boldUprightKey = fontCacheKey(family, 700, false)

  return (
    fonts.byKey.get(preferredKey) ??
    fonts.byKey.get(uprightKey) ??
    (weight >= 700 ? fonts.byKey.get(boldKey) : undefined) ??
    (weight >= 700 ? fonts.byKey.get(boldUprightKey) : undefined) ??
    fonts.byKey.get(regularKey) ??
    fonts.byKey.get(regularUprightKey) ??
    (weight >= 700 ? fonts.fallbackBold : fonts.fallbackRegular)
  )
}