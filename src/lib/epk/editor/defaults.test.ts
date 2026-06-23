import { describe, expect, it } from 'vitest'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import { createDefaultElement, getNextZIndex } from './defaults'

const baseDocument: EpkDocumentV2 = {
  version: 2,
  pageFormat: 'a4',
  orientation: 'portrait',
  pages: [
    {
      id: 'page-1',
      width: 794,
      height: 1123,
      background: { type: 'color', color: '#101010' },
    },
  ],
  elements: [
    {
      id: 'el-1',
      pageId: 'page-1',
      type: 'text',
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      rotation: 0,
      zIndex: 3,
      locked: false,
      visible: true,
      style: {},
      content: 'Hello',
    },
  ],
  fonts: [],
  metadata: {},
}

describe('epk editor defaults', () => {
  it('computes next z-index', () => {
    expect(getNextZIndex(baseDocument, 'page-1')).toBe(4)
  })

  it('creates a text element with defaults', () => {
    const el = createDefaultElement('text', 'page-1', baseDocument)
    expect(el.type).toBe('text')
    expect(el.zIndex).toBe(4)
    expect(el.content).toBe('New text')
  })

  it('creates a shape element with defaults', () => {
    const el = createDefaultElement('shape', 'page-1', baseDocument)
    expect(el.type).toBe('shape')
    expect(el.style.fill).toBe('#493687')
  })

  it('creates an image element with src override', () => {
    const el = createDefaultElement('image', 'page-1', baseDocument, {
      src: 'https://cdn.example.com/photo.jpg',
    })
    expect(el.type).toBe('image')
    expect(el.src).toBe('https://cdn.example.com/photo.jpg')
    expect(el.width).toBe(240)
  })
})