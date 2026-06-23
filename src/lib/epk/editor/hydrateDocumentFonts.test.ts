import { describe, expect, it } from 'vitest'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import { hydrateDocumentFonts } from './hydrateDocumentFonts'

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
  elements: [],
  fonts: [{ id: 'font-1', family: 'Band Sans', r2Key: 'epk-fonts/a.woff2' }],
  metadata: {},
}

describe('hydrateDocumentFonts', () => {
  it('adds public src URLs from font assets', () => {
    const hydrated = hydrateDocumentFonts(baseDocument, [
      { id: 'font-1', publicUrl: 'https://cdn.example.com/epk-fonts/a.woff2' },
    ])
    expect(hydrated.fonts[0]?.src).toBe('https://cdn.example.com/epk-fonts/a.woff2')
  })
})