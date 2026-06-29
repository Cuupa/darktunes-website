/**
 * Applies Konva-compatible element transforms for PDF export.
 * Konva rotates around the element top-left corner by default.
 */

import {
  concatTransformationMatrix,
  popGraphicsState,
  pushGraphicsState,
  type PDFPage,
} from 'pdf-lib'

export interface PdfElementBox {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

export interface PdfElementDrawContext {
  localX: number
  localPdfBottomY: number
  width: number
  height: number
}

export function withPdfElementTransform(
  page: PDFPage,
  box: PdfElementBox,
  scaleFactor: number,
  pageHeight: number,
  draw: (ctx: PdfElementDrawContext) => void | Promise<void>,
): void | Promise<void> {
  const width = box.width * scaleFactor
  const height = box.height * scaleFactor
  const x = box.x * scaleFactor
  const canvasY = box.y * scaleFactor
  const pdfBottomY = pageHeight - canvasY - height

  if (!box.rotation) {
    return draw({ localX: x, localPdfBottomY: pdfBottomY, width, height })
  }

  const pivotX = x
  const pivotY = pageHeight - canvasY
  const radians = (-box.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  page.pushOperators(pushGraphicsState())
  page.pushOperators(
    concatTransformationMatrix(1, 0, 0, 1, pivotX, pivotY),
    concatTransformationMatrix(cos, sin, -sin, cos, 0, 0),
  )

  const result = draw({ localX: 0, localPdfBottomY: -height, width, height })
  page.pushOperators(popGraphicsState())
  return result
}