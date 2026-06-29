/**
 * src/lib/epk/export/renderDocumentToPdf.ts
 *
 * Renders an EpkDocumentV2 JSON document to a PDF byte array.
 * Uses pdf-lib for vector layout + Sharp-compressed embedded images.
 * Element coordinates match the Konva canvas coordinate system.
 */

import {
  PDFDocument,
  concatTransformationMatrix,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type PDFPage,
  type RGB,
} from 'pdf-lib'
import type { EpkDocumentV2, EpkElement } from '@/lib/epk/schema/documentV2'
import { getCanvasToPdfScale, getPdfPageDimensions } from '@/lib/epk/schema/pageDimensions'
import { fetchAndCompressImage } from './fetchImageBytes'
import { embedPdfMetadata } from './embedMetadata'
import { parseColorOpacity, parseColorToRgb } from './colorUtils'
import { embedDocumentFonts, resolvePdfFont, type PdfFontSet } from './embedDocumentFonts'
import { flattenGroupElements } from '@/lib/epk/elements/groupUtils'
import { getEpkImageLayout } from '@/lib/epk/imageFit'
import { layoutWrappedText, type TextAlign } from '@/lib/epk/textLayout'
import { parseGradientFromBackground, parseGradientFromStyle } from '@/lib/epk/gradients'
import { renderGradientToJpeg } from './renderGradientToJpeg'
import { renderShapeToJpeg } from './renderShapeToJpeg'
import { withPdfElementTransform } from './pdfElementTransform'
import { EPK_PDF_SAVE_OPTIONS } from './pdfSaveOptions'

const DEFAULT_TEXT: RGB = rgb(1, 1, 1)
const DEFAULT_SHAPE: RGB = rgb(0.16, 0.16, 0.16)

function scale(value: number, factor: number): number {
  return value * factor
}

function resolveElementOpacity(style: EpkElement['style']): number {
  const fillOpacity = parseColorOpacity(style.fill)
  return (style.opacity ?? 1) * fillOpacity
}

async function drawElement(
  page: PDFPage,
  element: EpkElement,
  factor: number,
  fonts: PdfFontSet,
  pdfDoc: PDFDocument,
): Promise<void> {
  if (!element.visible) return

  const pageHeight = page.getHeight()
  const opacity = resolveElementOpacity(element.style)

  await withPdfElementTransform(
    page,
    {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation,
    },
    factor,
    pageHeight,
    async (ctx) => {
      const { localX, localPdfBottomY, width, height } = ctx

      switch (element.type) {
        case 'shape': {
          const gradient = parseGradientFromStyle(element.style)
          if (gradient) {
            const raster = await renderGradientToJpeg(element.width, element.height, gradient)
            if (raster) {
              const embedded = await pdfDoc.embedJpg(raster.bytes)
              page.drawImage(embedded, {
                x: localX,
                y: localPdfBottomY,
                width,
                height,
                opacity,
              })
              break
            }
          }

          const fillColor = element.style.fill ?? '#292929'
          const cornerRadius = element.style.cornerRadius ?? 0
          if (cornerRadius > 0) {
            const raster = await renderShapeToJpeg(element.width, element.height, {
              fill: fillColor,
              cornerRadius,
              stroke: element.style.stroke,
              strokeWidth: element.style.strokeWidth,
            })
            if (raster) {
              const embedded = await pdfDoc.embedJpg(raster.bytes)
              page.drawImage(embedded, {
                x: localX,
                y: localPdfBottomY,
                width,
                height,
                opacity,
              })
              break
            }
          }

          const fill = parseColorToRgb(fillColor, DEFAULT_SHAPE)
          page.drawRectangle({
            x: localX,
            y: localPdfBottomY,
            width,
            height,
            color: fill,
            opacity,
            borderWidth: element.style.strokeWidth
              ? scale(element.style.strokeWidth, factor)
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
          const fontSize = scale(element.style.fontSize ?? 14, factor)
          const fill = parseColorToRgb(element.style.fill, DEFAULT_TEXT)
          const padding = scale(4, factor)
          const textAlign = (element.style.textAlign ?? 'left') as TextAlign
          const wrapped = layoutWrappedText({
            text: element.content,
            font,
            fontSize,
            boxX: localX,
            boxY: localPdfBottomY,
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
          const imageData = await fetchAndCompressImage(element.src, 1200, {
            crop: element.crop,
            flipX: element.flipX,
            flipY: element.flipY,
          })
          if (!imageData) break

          const layout = getEpkImageLayout(
            { ...element, crop: undefined },
            imageData.width,
            imageData.height,
          )
          const embedded = await pdfDoc.embedJpg(imageData.bytes)
          const imageX = localX + scale(layout.offsetX, factor)
          const imageY = localPdfBottomY + scale(layout.offsetY, factor)
          const imageW = scale(layout.drawWidth, factor)
          const imageH = scale(layout.drawHeight, factor)

          if (element.flipX || element.flipY) {
            page.pushOperators(pushGraphicsState())
            page.pushOperators(
              concatTransformationMatrix(
                1,
                0,
                0,
                1,
                imageX + (element.flipX ? imageW : 0),
                imageY + (element.flipY ? imageH : 0),
              ),
              concatTransformationMatrix(element.flipX ? -1 : 1, 0, 0, element.flipY ? -1 : 1, 0, 0),
            )
            page.drawImage(embedded, {
              x: 0,
              y: 0,
              width: imageW,
              height: imageH,
              opacity,
            })
            page.pushOperators(popGraphicsState())
          } else {
            page.drawImage(embedded, {
              x: imageX,
              y: imageY,
              width: imageW,
              height: imageH,
              opacity,
            })
          }
          break
        }

        case 'group':
        default:
          break
      }
    },
  )
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

  const factor = getCanvasToPdfScale(document.pageFormat, document.orientation)

  for (const pageMeta of document.pages) {
    const pdfDims = getPdfPageDimensions(document.pageFormat, document.orientation)
    const page = pdfDoc.addPage([pdfDims.width, pdfDims.height])

    if (pageMeta.background.type === 'gradient') {
      const gradient = parseGradientFromBackground(pageMeta.background)
      if (gradient) {
        const raster = await renderGradientToJpeg(pageMeta.width, pageMeta.height, gradient)
        if (raster) {
          const embedded = await pdfDoc.embedJpg(raster.bytes)
          page.drawImage(embedded, {
            x: 0,
            y: 0,
            width: pdfDims.width,
            height: pdfDims.height,
          })
        }
      }
    } else if (pageMeta.background.type === 'color' && pageMeta.background.color) {
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
      await drawElement(page, element, factor, fonts, pdfDoc)
    }
  }

  embedPdfMetadata(pdfDoc, document.metadata)

  return pdfDoc.save(EPK_PDF_SAVE_OPTIONS)
}