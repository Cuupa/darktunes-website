/**
 * src/lib/epk/schema/pageDimensions.ts
 *
 * Canonical page dimensions for the EPK canvas (96 DPI logical pixels).
 */

import type { EpkOrientation, EpkPageFormat } from './documentV2'

export interface PageDimensions {
  width: number
  height: number
}

/** Base sizes at 96 DPI (matches browser canvas coordinates). */
const FORMAT_SIZES: Record<EpkPageFormat, PageDimensions> = {
  a4: { width: 794, height: 1123 },
  letter: { width: 816, height: 1056 },
  square: { width: 794, height: 794 },
}

export function getPageDimensions(
  format: EpkPageFormat,
  orientation: EpkOrientation,
): PageDimensions {
  const base = FORMAT_SIZES[format]
  if (orientation === 'landscape') {
    return { width: base.height, height: base.width }
  }
  return { ...base }
}

/** PDF point dimensions (72 DPI) for pdf-lib page creation. */
export function getPdfPageDimensions(
  format: EpkPageFormat,
  orientation: EpkOrientation,
): PageDimensions {
  const PDF_SIZES: Record<EpkPageFormat, PageDimensions> = {
    a4: { width: 595.28, height: 841.89 },
    letter: { width: 612, height: 792 },
    square: { width: 595.28, height: 595.28 },
  }
  const base = PDF_SIZES[format]
  if (orientation === 'landscape') {
    return { width: base.height, height: base.width }
  }
  return { ...base }
}

/** Scale factor from canvas logical px to PDF points. */
export function getCanvasToPdfScale(
  format: EpkPageFormat,
  orientation: EpkOrientation,
): number {
  const canvas = getPageDimensions(format, orientation)
  const pdf = getPdfPageDimensions(format, orientation)
  return pdf.width / canvas.width
}