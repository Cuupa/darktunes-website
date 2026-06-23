import { describe, expect, it } from 'vitest'
import { renderDocumentToPdf } from './renderDocumentToPdf'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'

const minimalDocument: EpkDocumentV2 = {
  version: 2,
  pageFormat: 'a4',
  orientation: 'portrait',
  pages: [
    {
      id: 'page-1',
      name: 'Cover',
      width: 794,
      height: 1123,
      background: { type: 'color', color: '#101010' },
    },
  ],
  elements: [
    {
      id: 'shape-1',
      pageId: 'page-1',
      type: 'shape',
      x: 0,
      y: 0,
      width: 794,
      height: 120,
      rotation: 0,
      zIndex: 1,
      locked: false,
      visible: true,
      style: { fill: '#493687' },
    },
    {
      id: 'text-1',
      pageId: 'page-1',
      type: 'text',
      x: 48,
      y: 160,
      width: 400,
      height: 48,
      rotation: 0,
      zIndex: 2,
      locked: false,
      visible: true,
      content: 'Test Artist — EPK',
      style: { fill: '#ffffff', fontSize: 28, fontWeight: 700 },
    },
  ],
  fonts: [],
  metadata: {
    title: 'Test Artist EPK',
    author: 'darkTunes',
    subject: 'Electronic Press Kit',
  },
}

describe('renderDocumentToPdf', () => {
  it('returns valid PDF bytes', async () => {
    const bytes = await renderDocumentToPdf({ document: minimalDocument })
    expect(bytes.length).toBeGreaterThan(500)
    const header = String.fromCharCode(...bytes.slice(0, 4))
    expect(header).toBe('%PDF')
  })
})