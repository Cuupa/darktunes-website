import { describe, expect, it } from 'vitest'
import { getEpkImageLayout, getProportionalElementSize } from './imageFit'
import type { EpkElement } from '@/lib/epk/schema/documentV2'

function imageElement(overrides: Partial<EpkElement> = {}): EpkElement {
  return {
    id: 'img-1',
    pageId: 'page-1',
    type: 'image',
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    rotation: 0,
    zIndex: 1,
    locked: false,
    visible: true,
    style: { objectFit: 'contain' },
    src: 'https://cdn.example.com/photo.jpg',
    ...overrides,
  }
}

describe('imageFit', () => {
  it('scales images proportionally when inserting defaults', () => {
    expect(getProportionalElementSize(1600, 900)).toEqual({ width: 320, height: 180 })
  })

  it('keeps contain layout centered without stretching', () => {
    const layout = getEpkImageLayout(imageElement(), 400, 400)
    expect(layout.drawWidth).toBe(100)
    expect(layout.drawHeight).toBe(100)
    expect(layout.offsetX).toBe(50)
    expect(layout.offsetY).toBe(0)
  })
})