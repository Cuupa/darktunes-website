import { inflateSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderDocumentToPdf } from './renderDocumentToPdf'
import { generateEpkPdfBytes } from './generateEpkPdfBytes'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'

const SRGB_ICC_PATH = join(
  process.cwd(),
  'src/lib/epk/export/assets/sRGB-IEC61966-2.1.icc',
)

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

function assertEmbeddedFontStreamsAreNotWebFonts(pdfBytes: Uint8Array): void {
  const text = new TextDecoder('latin1').decode(pdfBytes)
  const streams = [...text.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]

  for (const match of streams) {
    const raw = match[1]
    if (!raw) continue
    try {
      const inflated = inflateSync(Buffer.from(raw, 'latin1'))
      if (inflated.length < 4) continue
      const magic = inflated.subarray(0, 4).toString('ascii')
      expect(magic).not.toBe('wOF2')
      expect(magic).not.toBe('wOFF')
    } catch (error) {
      if (error instanceof Error && error.message.includes('web font')) throw error
    }
  }
}

describe('renderDocumentToPdf', () => {
  it('returns valid PDF bytes', async () => {
    const bytes = await renderDocumentToPdf({ document: minimalDocument })
    expect(bytes.length).toBeGreaterThan(500)
    const header = String.fromCharCode(...bytes.slice(0, 4))
    expect(header).toBe('%PDF')
  })

  it('embeds subsetted SFNT fonts instead of raw WOFF2', async () => {
    const bytes = await renderDocumentToPdf({ document: minimalDocument })
    assertEmbeddedFontStreamsAreNotWebFonts(bytes)
  })

  it('renders rotated elements and rounded shapes', async () => {
    const document: EpkDocumentV2 = {
      ...minimalDocument,
      elements: [
        {
          id: 'shape-rounded',
          pageId: 'page-1',
          type: 'shape',
          x: 60,
          y: 260,
          width: 180,
          height: 80,
          rotation: 12,
          zIndex: 3,
          locked: false,
          visible: true,
          style: { fill: '#493687', cornerRadius: 16 },
        },
        {
          ...minimalDocument.elements[1]!,
          id: 'text-rotated',
          y: 360,
          rotation: -8,
          content: 'Rotated copy',
        },
      ],
    }

    const bytes = await renderDocumentToPdf({ document })
    expect(bytes.length).toBeGreaterThan(500)
    assertEmbeddedFontStreamsAreNotWebFonts(bytes)
  })

  it('renders German punctuation with bundled fallback fonts', async () => {
    const document: EpkDocumentV2 = {
      ...minimalDocument,
      elements: [
        {
          ...minimalDocument.elements[1]!,
          content: 'Müller — äöüß',
          style: {
            fill: '#ffffff',
            fontSize: 20,
            fontWeight: 600,
          },
        },
      ],
    }

    const bytes = await renderDocumentToPdf({ document })
    expect(bytes.length).toBeGreaterThan(500)
    assertEmbeddedFontStreamsAreNotWebFonts(bytes)
  })
})

describe('bundled sRGB ICC profile', () => {
  it('is a valid ICC file on disk (not HTML)', () => {
    const bytes = readFileSync(SRGB_ICC_PATH)
    expect(bytes.length).toBeGreaterThan(500)

    const header = bytes.slice(0, 9).toString('utf8')
    expect(header).not.toMatch(/^<!DOCTYPE/i)
    expect(header).not.toMatch(/^<html/i)

    const acsp = bytes.slice(36, 40).toString('ascii')
    expect(acsp).toBe('acsp')
  })
})

describe('generateEpkPdfBytes', () => {
  it('returns PDF/A-marked bytes with embedded fonts', async () => {
    const bytes = await generateEpkPdfBytes({ document: minimalDocument })
    expect(bytes.length).toBeGreaterThan(500)

    const text = new TextDecoder().decode(bytes)
    expect(text).toContain('pdfaid:part>2')
    expect(text).toContain('pdfaid:conformance>B')
    expect(text).toContain('/OutputIntent')
    expect(text).toContain('/FontFile')
  })
})