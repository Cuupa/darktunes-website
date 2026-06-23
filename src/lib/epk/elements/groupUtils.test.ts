import { describe, expect, it } from 'vitest'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import {
  computeGroupBounds,
  createGroupFromElements,
  flattenGroupElements,
  getTopLevelPageElements,
} from './groupUtils'

const baseDocument: EpkDocumentV2 = {
  version: 2,
  pageFormat: 'a4',
  orientation: 'portrait',
  pages: [{ id: 'page-1', width: 800, height: 1100, background: { type: 'color', color: '#101010' } }],
  elements: [
    {
      id: 'text-1',
      pageId: 'page-1',
      type: 'text',
      x: 10,
      y: 20,
      width: 100,
      height: 40,
      rotation: 0,
      zIndex: 1,
      locked: false,
      visible: true,
      style: {},
      content: 'A',
    },
    {
      id: 'shape-1',
      pageId: 'page-1',
      type: 'shape',
      x: 120,
      y: 30,
      width: 80,
      height: 60,
      rotation: 0,
      zIndex: 2,
      locked: false,
      visible: true,
      style: {},
    },
  ],
  fonts: [],
  metadata: {},
}

describe('groupUtils', () => {
  it('computes group bounds from child elements', () => {
    expect(computeGroupBounds(baseDocument.elements)).toEqual({
      x: 10,
      y: 20,
      width: 190,
      height: 70,
    })
  })

  it('creates a group from two selected elements', () => {
    const group = createGroupFromElements(baseDocument, 'page-1', ['text-1', 'shape-1'])
    expect(group?.type).toBe('group')
    expect(group?.children).toEqual(['text-1', 'shape-1'])
  })

  it('hides grouped children from top-level page elements', () => {
    const group = createGroupFromElements(baseDocument, 'page-1', ['text-1', 'shape-1'])
    const document = {
      ...baseDocument,
      elements: [...baseDocument.elements, group!],
    }
    const topLevel = getTopLevelPageElements(document, 'page-1')
    expect(topLevel).toHaveLength(1)
    expect(topLevel[0].type).toBe('group')
  })

  it('flattens grouped children for PDF export order', () => {
    const group = createGroupFromElements(baseDocument, 'page-1', ['text-1', 'shape-1'])
    const document = {
      ...baseDocument,
      elements: [...baseDocument.elements, group!],
    }
    const flattened = flattenGroupElements(document, 'page-1')
    expect(flattened.map((el) => el.id)).toEqual(['text-1', 'shape-1'])
  })
})