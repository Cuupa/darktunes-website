import { describe, expect, it } from 'vitest'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import { createEpkEditorStore } from './store'

const baseDocument: EpkDocumentV2 = {
  version: 2,
  pageFormat: 'a4',
  orientation: 'portrait',
  pages: [
    {
      id: 'page-1',
      name: 'Page 1',
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
      x: 10,
      y: 10,
      width: 100,
      height: 40,
      rotation: 0,
      zIndex: 1,
      locked: false,
      visible: true,
      style: {},
      content: 'Hello',
    },
  ],
  fonts: [],
  metadata: {},
}

describe('epk editor store pages', () => {
  it('adds a new page and switches active page', () => {
    const store = createEpkEditorStore(baseDocument)
    const pageId = store.getState().addPage('Bio')
    expect(store.getState().document.pages).toHaveLength(2)
    expect(store.getState().activePageId).toBe(pageId)
    expect(store.getState().isDirty).toBe(true)
  })

  it('duplicates a page with its elements', () => {
    const store = createEpkEditorStore(baseDocument)
    const newPageId = store.getState().duplicatePage('page-1')
    expect(store.getState().document.pages).toHaveLength(2)
    expect(store.getState().document.elements).toHaveLength(2)
    expect(store.getState().document.elements[1]?.pageId).toBe(newPageId)
    expect(store.getState().document.elements[1]?.id).not.toBe('el-1')
  })

  it('does not remove the last remaining page', () => {
    const store = createEpkEditorStore(baseDocument)
    store.getState().removePage('page-1')
    expect(store.getState().document.pages).toHaveLength(1)
  })
})

describe('epk editor store layers', () => {
  const multiLayerDocument: EpkDocumentV2 = {
    ...baseDocument,
    elements: [
      {
        id: 'el-back',
        pageId: 'page-1',
        type: 'shape',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        zIndex: 1,
        locked: false,
        visible: true,
        style: {},
      },
      {
        id: 'el-mid',
        pageId: 'page-1',
        type: 'text',
        x: 10,
        y: 10,
        width: 100,
        height: 40,
        rotation: 0,
        zIndex: 2,
        locked: false,
        visible: true,
        style: {},
        content: 'Middle',
      },
      {
        id: 'el-front',
        pageId: 'page-1',
        type: 'image',
        x: 20,
        y: 20,
        width: 80,
        height: 80,
        rotation: 0,
        zIndex: 3,
        locked: false,
        visible: true,
        style: {},
        src: 'https://example.com/img.jpg',
      },
    ],
  }

  it('reorders layers via drag-and-drop order (front to back)', () => {
    const store = createEpkEditorStore(multiLayerDocument)
    store.getState().reorderElementLayers(['el-mid', 'el-front', 'el-back'])

    const pageElements = store
      .getState()
      .document.elements.filter((el) => el.pageId === 'page-1')
      .sort((a, b) => b.zIndex - a.zIndex)

    expect(pageElements.map((el) => el.id)).toEqual(['el-mid', 'el-front', 'el-back'])
    expect(store.getState().isDirty).toBe(true)
  })

  it('ignores invalid layer reorder payloads', () => {
    const store = createEpkEditorStore(multiLayerDocument)
    store.getState().reorderElementLayers(['el-front', 'el-back'])

    const pageElements = store
      .getState()
      .document.elements.filter((el) => el.pageId === 'page-1')
      .sort((a, b) => b.zIndex - a.zIndex)

    expect(pageElements.map((el) => el.id)).toEqual(['el-front', 'el-mid', 'el-back'])
  })
})