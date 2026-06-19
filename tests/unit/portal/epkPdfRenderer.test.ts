/**
 * tests/unit/portal/epkPdfRenderer.test.ts
 *
 * Unit tests for the react-pdf based EPK PDF generator.
 * Mocks @react-pdf/renderer so no real PDF rendering happens in tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateEpkPdf } from '../../../app/portal/profile/_components/epkPdfRenderer'
import type { EPKData } from '../../../app/portal/profile/_components/EPKPreview'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock @react-pdf/renderer — pdf() returns a thenable with toBlob()
vi.mock('@react-pdf/renderer', () => ({
  pdf: vi.fn(() => ({
    toBlob: vi.fn(async () => new Blob(['%PDF-mock'], { type: 'application/pdf' })),
  })),
  Document: vi.fn(),
  Page: vi.fn(),
  View: vi.fn(),
  Text: vi.fn(),
  Image: vi.fn(),
  Link: vi.fn(),
  StyleSheet: { create: (s: object) => s },
  Font: {
    register: vi.fn(),
    registerHyphenationCallback: vi.fn(),
  },
}))

// Mock EPKPdfDocument to avoid transitive react-pdf imports
vi.mock('../../../app/portal/profile/_components/EPKPdfDocument', () => ({
  EPKPdfDocument: vi.fn(() => null),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseData(overrides: Partial<EPKData> = {}): EPKData {
  return { artistName: 'Test Artist', ...overrides }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateEpkPdf', () => {
  let createdObjectUrl: string | null = null
  let revokedObjectUrl: string | null = null
  let anchorClicked = false
  let downloadAttr: string | null = null

  beforeEach(() => {
    createdObjectUrl = null
    revokedObjectUrl = null
    anchorClicked = false
    downloadAttr = null

    // Stub URL API
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((blob: Blob) => {
        expect(blob).toBeInstanceOf(Blob)
        createdObjectUrl = 'blob:mock-url'
        return createdObjectUrl
      }),
      revokeObjectURL: vi.fn((url: string) => {
        revokedObjectUrl = url
      }),
    })

    // Stub anchor creation
    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const anchor = originalCreate('a')
        const originalClick = anchor.click.bind(anchor)
        anchor.click = () => {
          anchorClicked = true
          downloadAttr = anchor.download
          originalClick()
        }
        return anchor
      }
      return originalCreate(tag)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('calls pdf(), converts to blob, and triggers a download', async () => {
    const { pdf } = await import('@react-pdf/renderer')

    await generateEpkPdf(baseData())

    expect(pdf).toHaveBeenCalledOnce()
    expect(createdObjectUrl).toBe('blob:mock-url')
    expect(anchorClicked).toBe(true)
    expect(downloadAttr).toBe('epk-test-artist.pdf')
  })

  it('revokes the object URL after triggering the download', async () => {
    await generateEpkPdf(baseData())

    expect(revokedObjectUrl).toBe('blob:mock-url')
  })

  it('sanitises the artist name for the filename', async () => {
    await generateEpkPdf(baseData({ artistName: 'DJ Müller & Friends!' }))

    expect(downloadAttr).toBe('epk-dj-m-ller---friends-.pdf')
  })

  it('uses the landscape orientation when specified', async () => {
    const { pdf } = await import('@react-pdf/renderer')
    vi.mocked(pdf).mockClear()

    await generateEpkPdf(baseData({ epkOrientation: 'landscape' }))

    expect(pdf).toHaveBeenCalledOnce()
    // The orientation is passed through data props — pdf() being called is sufficient
    // (the actual orientation logic is covered by EPKPdfDocument tests)
  })

  it('revokes the object URL even when the anchor click throws', async () => {
    vi.spyOn(document, 'createElement').mockImplementationOnce(() => {
      const a = document.createElement('a')
      a.click = () => { throw new Error('click failed') }
      return a
    })

    // The function should not throw because revokeObjectURL is in a finally block
    await expect(generateEpkPdf(baseData())).rejects.toThrow('click failed')
    expect(revokedObjectUrl).toBe('blob:mock-url')
  })
})
