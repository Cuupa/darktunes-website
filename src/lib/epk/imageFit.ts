import type { EpkElement, EpkImageCrop } from '@/lib/epk/schema/documentV2'

export interface EpkImageLayout {
  offsetX: number
  offsetY: number
  drawWidth: number
  drawHeight: number
  crop?: EpkImageCrop
}

export function getDefaultImageCrop(naturalWidth: number, naturalHeight: number): EpkImageCrop {
  return { x: 0, y: 0, width: naturalWidth, height: naturalHeight }
}

export function getProportionalElementSize(
  naturalWidth: number,
  naturalHeight: number,
  maxEdge = 320,
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { width: 240, height: 240 }
  }
  const scale = Math.min(maxEdge / naturalWidth, maxEdge / naturalHeight, 1)
  return {
    width: Math.round(naturalWidth * scale),
    height: Math.round(naturalHeight * scale),
  }
}

export function getEpkImageLayout(
  element: EpkElement,
  naturalWidth: number,
  naturalHeight: number,
): EpkImageLayout {
  const crop = element.crop ?? getDefaultImageCrop(naturalWidth, naturalHeight)
  const objectFit = element.style.objectFit ?? 'contain'

  if (objectFit === 'fill' || element.width <= 0 || element.height <= 0) {
    return {
      offsetX: 0,
      offsetY: 0,
      drawWidth: element.width,
      drawHeight: element.height,
      crop,
    }
  }

  const scale =
    objectFit === 'cover'
      ? Math.max(element.width / crop.width, element.height / crop.height)
      : Math.min(element.width / crop.width, element.height / crop.height)

  const drawWidth = crop.width * scale
  const drawHeight = crop.height * scale

  return {
    offsetX: (element.width - drawWidth) / 2,
    offsetY: (element.height - drawHeight) / 2,
    drawWidth,
    drawHeight,
    crop,
  }
}