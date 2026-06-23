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