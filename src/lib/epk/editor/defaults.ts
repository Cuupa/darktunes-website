/**
 * src/lib/epk/editor/defaults.ts
 *
 * Factory helpers for new canvas elements in the EPK editor.
 */

import type { EpkDocumentV2, EpkElement, EpkElementType } from '@/lib/epk/schema/documentV2'
import { createEpkElementId } from '@/lib/epk/schema/elementIds'

export function getNextZIndex(document: EpkDocumentV2, pageId: string): number {
  const pageElements = document.elements.filter((el) => el.pageId === pageId)
  if (pageElements.length === 0) return 1
  return Math.max(...pageElements.map((el) => el.zIndex)) + 1
}

export function createDefaultElement(
  type: EpkElementType,
  pageId: string,
  document: EpkDocumentV2,
  overrides?: Partial<EpkElement>,
): EpkElement {
  const page = document.pages.find((p) => p.id === pageId)
  const centerX = page ? page.width / 2 - 100 : 100
  const centerY = page ? page.height / 2 - 40 : 100
  const zIndex = getNextZIndex(document, pageId)

  const base: EpkElement = {
    id: createEpkElementId(type),
    pageId,
    type,
    x: centerX,
    y: centerY,
    width: 200,
    height: 48,
    rotation: 0,
    zIndex,
    locked: false,
    visible: true,
    style: {},
  }

  if (type === 'text') {
    return {
      ...base,
      content: 'New text',
      style: {
        fill: '#ffffff',
        fontSize: 18,
        fontFamily: 'Helvetica, Arial, sans-serif',
        textAlign: 'left',
        lineHeight: 1.4,
      },
      ...overrides,
    }
  }

  if (type === 'shape') {
    return {
      ...base,
      width: 160,
      height: 80,
      style: {
        fill: '#493687',
        opacity: 1,
        cornerRadius: 4,
      },
      ...overrides,
    }
  }

  if (type === 'image' || type === 'logo') {
    return {
      ...base,
      width: 240,
      height: 240,
      src: overrides?.src,
      style: {
        opacity: 1,
      },
      ...overrides,
    }
  }

  return { ...base, ...overrides }
}