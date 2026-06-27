import { describe, expect, it } from 'vitest'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import { ensureDocumentFontsForExport } from './ensureDocumentFontsForExport'

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
      id: 'text-1',
      pageId: 'page-1',
      type: 'text',
      x: 40,
      y: 40,
      width: 200,
      height: 80,
      rotation: 0,
      zIndex: 1,
      locked: false,
      visible: true,
      content: 'Hello',
      style: { fontFamily: 'Band Sans', fontSize: 24 },
    },
  ],
  fonts: [],
  metadata: {},
}

describe('ensureDocumentFontsForExport', () => {
  it('hydrates custom fonts referenced by text elements', () => {
    const result = ensureDocumentFontsForExport(baseDocument, [
      {
        id: 'font-1',
        name: 'Band Sans',
        r2Key: 'epk-fonts/band.woff2',
        publicUrl: 'https://cdn.example.com/epk-fonts/band.woff2',
      },
    ])

    expect(result.fonts).toHaveLength(1)
    expect(result.fonts[0]).toMatchObject({
      id: 'font-1',
      family: 'Band Sans',
      src: 'https://cdn.example.com/epk-fonts/band.woff2',
      r2Key: 'epk-fonts/band.woff2',
    })
  })

  it('registers google fonts used in text elements', () => {
    const doc: EpkDocumentV2 = {
      ...baseDocument,
      elements: [
        {
          ...baseDocument.elements[0]!,
          style: { fontFamily: 'Inter', fontSize: 18 },
        },
      ],
    }

    const result = ensureDocumentFontsForExport(doc, [])
    expect(result.fonts.some((font) => font.family === 'Inter')).toBe(true)
  })
})