/**
 * src/lib/epk/export/embedDocumentFonts.ts
 *
 * Embeds custom document fonts into a pdf-lib PDFDocument via fontkit.
 * Uses fully embedded Noto Sans fallbacks instead of non-embedded Standard fonts.
 */

import { create as createFontkitFont } from 'fontkit'
import type { PDFDocument, PDFFont } from 'pdf-lib'

const fontkit = { create: createFontkitFont }
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import { buildEpkFontPublicUrl } from '@/lib/api/epkFonts'
import { fetchRemoteBytes } from './fetchRemoteBytes'
import { fetchGoogleFontBytes } from './fetchGoogleFontBytes'
import { isGoogleFontFamily } from '@/lib/epk/googleFonts'
import { FALLBACK_FONT_FAMILY, loadBundledNotoSans } from './bundledFallbackFonts'

export interface PdfFontSet {
  fallbackRegular: PDFFont
  fallbackBold: PDFFont
  byKey: Map<string, PDFFont>
}

export function fontCacheKey(family: string, weight: number): string {
  return `${family}:${weight}`
}

export function isBoldFontWeight(fontWeight?: number | string): boolean {
  if (fontWeight === 'bold') return true
  const numeric = typeof fontWeight === 'number' ? fontWeight : Number.parseInt(String(fontWeight), 10)
  return Number.isFinite(numeric) && numeric >= 600
}

async function embedFontBytes(
  pdfDoc: PDFDocument,
  byKey: Map<string, PDFFont>,
  family: string,
  weight: number,
  bytes: Uint8Array | null,
): Promise<void> {
  if (!bytes) return
  const key = fontCacheKey(family, weight)
  if (byKey.has(key)) return

  try {
    const embedded = await pdfDoc.embedFont(bytes, { subset: false })
    byKey.set(key, embedded)
  } catch {
    // Skip unsupported or corrupt font files.
  }
}

async function embedGoogleFamily(
  pdfDoc: PDFDocument,
  byKey: Map<string, PDFFont>,
  family: string,
  weights: number[],
): Promise<void> {
  for (const weight of weights) {
    const bytes = await fetchGoogleFontBytes(family, weight)
    await embedFontBytes(pdfDoc, byKey, family, weight, bytes)
  }
}

function collectRequestedWeights(document: EpkDocumentV2): Map<string, Set<number>> {
  const requested = new Map<string, Set<number>>()

  const addWeight = (family: string, weight: number) => {
    const set = requested.get(family) ?? new Set<number>()
    set.add(weight)
    requested.set(family, set)
  }

  for (const font of document.fonts) {
    addWeight(font.family, 400)
    addWeight(font.family, 700)
  }

  for (const element of document.elements) {
    if (element.type !== 'text') continue
    const family = element.style.fontFamily?.trim() || FALLBACK_FONT_FAMILY
    addWeight(family, 400)
    if (isBoldFontWeight(element.style.fontWeight)) {
      addWeight(family, 700)
    }
  }

  return requested
}

export async function embedDocumentFonts(
  pdfDoc: PDFDocument,
  document: EpkDocumentV2,
  r2PublicUrl?: string,
): Promise<PdfFontSet> {
  pdfDoc.registerFontkit(fontkit)
  const byKey = new Map<string, PDFFont>()

  const bundled = loadBundledNotoSans()
  const fallbackRegular = await pdfDoc.embedFont(bundled.regular, { subset: false })
  const fallbackBold = await pdfDoc.embedFont(bundled.bold, { subset: false })

  byKey.set(fontCacheKey(FALLBACK_FONT_FAMILY, 400), fallbackRegular)
  byKey.set(fontCacheKey(FALLBACK_FONT_FAMILY, 700), fallbackBold)
  byKey.set(fontCacheKey('Helvetica, Arial, sans-serif', 400), fallbackRegular)
  byKey.set(fontCacheKey('Helvetica, Arial, sans-serif', 700), fallbackBold)
  byKey.set(fontCacheKey('Helvetica', 400), fallbackRegular)
  byKey.set(fontCacheKey('Helvetica', 700), fallbackBold)

  for (const font of document.fonts) {
    if (isGoogleFontFamily(font.family)) {
      await embedGoogleFamily(pdfDoc, byKey, font.family, [400, 700])
      continue
    }

    const url =
      font.src ??
      (font.r2Key && r2PublicUrl ? buildEpkFontPublicUrl(font.r2Key, r2PublicUrl) : undefined)
    const bytes = url ? await fetchRemoteBytes(url, r2PublicUrl) : null
    await embedFontBytes(pdfDoc, byKey, font.family, 400, bytes)
    await embedFontBytes(pdfDoc, byKey, font.family, 700, bytes)
  }

  const requested = collectRequestedWeights(document)
  for (const [family, weights] of requested) {
    if (!isGoogleFontFamily(family)) continue
    await embedGoogleFamily(pdfDoc, byKey, family, [...weights])
  }

  return { fallbackRegular, fallbackBold, byKey }
}

export function resolvePdfFont(
  fonts: PdfFontSet,
  style: { fontFamily?: string; fontWeight?: number | string },
): PDFFont {
  const family = style.fontFamily?.trim() || FALLBACK_FONT_FAMILY
  const bold = isBoldFontWeight(style.fontWeight)
  const preferredKey = fontCacheKey(family, bold ? 700 : 400)
  const regularKey = fontCacheKey(family, 400)

  return (
    fonts.byKey.get(preferredKey) ??
    fonts.byKey.get(regularKey) ??
    (bold ? fonts.fallbackBold : fonts.fallbackRegular)
  )
}