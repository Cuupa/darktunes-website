/**
 * src/lib/epk/export/renderDocumentToPdf.ts
 *
 * Renders an EpkDocumentV2 JSON document to a PDF byte array.
 * Uses pdf-lib for vector layout + Sharp-compressed embedded images.
 * Element coordinates match the Konva canvas coordinate system.
 */

import {
  PDFDocument,
  rgb,
  type PDFPage,
  type RGB,
} from 'pdf-lib'
import type { EpkDocumentV2, EpkElement } from '@/lib/epk/schema/documentV2'
import { getCanvasToPdfScale, getPdfPageDimensions } from '@/lib/epk/schema/pageDimensions'
import { fetchAndCompressImage } from './fetchImageBytes'
import { embedPdfMetadata } from './embedMetadata'
import { parseColorToRgb } from './colorUtils'
import { embedDocumentFonts, resolvePdfFont, type PdfFontSet } from './embedDocumentFonts'
import { flattenGroupElements } from '@/lib/epk/elements/groupUtils'
import { getEpkImageLayout } from '@/lib/epk/imageFit'
import { layoutWrappedText, type TextAlign } from '@/lib/epk/textLayout'

const DEFAULT_TEXT: RGB = rgb(1, 1, 1)
const DEFAULT_SHAPE: RGB = rgb(0.16, 0.16, 0.16)

function scale(value: number, factor: number): number {
  return value * factor
}

async function drawElement(
  page: PDFPage,
  element: EpkElement,
  scaleFactor: number,
  fonts: PdfFontSet,
  pdfDoc: PDFDocument,
): Promise<void> {
  if (!element.visible) return

  const x = scale(element.x, scaleFactor)
  const y = scale(element.y, scaleFactor)
  const width = scale(element.width, scaleFactor)
  const height = scale(element.height, scaleFactor)
  const pageHeight = page.getHeight()
  const pdfY = pageHeight - y - height

  const opacity = element.style.opacity ?? 1

  switch (element.type) {
    case 'shape': {
      const fill = parseColorToRgb(element.style.fill, DEFAULT_SHAPE)
      page.drawRectangle({
        x,
        y: pdfY,
        width,
        height,
        color: fill,
        opacity,
        borderWidth: element.style.strokeWidth
          ? scale(element.style.strokeWidth, scaleFactor)
          : 0,
        borderColor: element.style.stroke
          ? parseColorToRgb(element.style.stroke, fill)
          : undefined,
      })
      break
    }

    case 'text': {
      if (!element.content) break
      const font = resolvePdfFont(fonts, element.style)
      const fontSize = scale(element.style.fontSize ?? 14, scaleFactor)
      const fill = parseColorToRgb(element.style.fill, DEFAULT_TEXT)
      const padding = scale(4, scaleFactor)
      const textAlign = (element.style.textAlign ?? 'left') as TextAlign
      const wrapped = layoutWrappedText({
        text: element.content,
        font,
        fontSize,
        boxX: x,
        boxY: pdfY,
        boxWidth: width,
        boxHeight: height,
        padding,
        lineHeight: element.style.lineHeight ?? 1.4,
        textAlign,
      })

      for (const line of wrapped) {
        page.drawText(line.text, {
          x: line.x,
          y: line.y,
          size: fontSize,
          font,
          color: fill,
          opacity,
          ...(line.align !== 'left' ? { align: line.align } : {}),
        })
      }
      break
    }

    case 'image':
    case 'logo': {
      if (!element.src) break
      const imageData = await fetchAndCompressImage(element.src, 1200, element.crop)
      if (!imageData) break

      const layout = getEpkImageLayout(
        { ...element, crop: undefined },
        imageData.width,
        imageData.height,
      )
      const embedded = await pdfDoc.embedJpg(imageData.bytes)
      page.drawImage(embedded, {
        x: x + scale(layout.offsetX, scaleFactor),
        y: pdfY + scale(layout.offsetY, scaleFactor),
        width: scale(layout.drawWidth, scaleFactor),
        height: scale(layout.drawHeight, scaleFactor),
        opacity,
      })
      break
    }

    case 'group':
      break
    default:
      break
  }
}

export interface RenderDocumentToPdfOptions {
  document: EpkDocumentV2
  r2PublicUrl?: string
}

export async function renderDocumentToPdf(
  options: RenderDocumentToPdfOptions,
): Promise<Uint8Array> {
  const { document, r2PublicUrl } = options
  const pdfDoc = await PDFDocument.create()
  const fonts = await embedDocumentFonts(pdfDoc, document, r2PublicUrl)

  const scaleFactor = getCanvasToPdfScale(document.pageFormat, document.orientation)
  const pdfPages: PDFPage[] = []

  for (const pageMeta of document.pages) {
    const pdfDims = getPdfPageDimensions(document.pageFormat, document.orientation)
    const page = pdfDoc.addPage([pdfDims.width, pdfDims.height])
    pdfPages.push(page)

    // Page background
    if (pageMeta.background.type === 'color' && pageMeta.background.color) {
      const bg = parseColorToRgb(pageMeta.background.color, DEFAULT_SHAPE)
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pdfDims.width,
        height: pdfDims.height,
        color: bg,
      })
    } else if (pageMeta.background.type === 'image' && pageMeta.background.src) {
      const bgImage = await fetchAndCompressImage(pageMeta.background.src, 1600)
      if (bgImage) {
        const embedded = await pdfDoc.embedJpg(bgImage.bytes)
        page.drawImage(embedded, {
          x: 0,
          y: 0,
          width: pdfDims.width,
          height: pdfDims.height,
          opacity: pageMeta.background.opacity ?? 1,
        })
      }
    }

    const pageElements = flattenGroupElements(document, pageMeta.id)

    for (const element of pageElements) {
      await drawElement(page, element, scaleFactor, fonts, pdfDoc)
    }
  }

  embedPdfMetadata(pdfDoc, document.metadata)

  return pdfDoc.save({ useObjectStreams: true })
}