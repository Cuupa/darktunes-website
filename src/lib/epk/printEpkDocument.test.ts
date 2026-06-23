import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  findEpkDocumentRoot,
  generateEpkPdfFromPreview,
  printEpkDocument,
  type EpkPdfMessages,
} from './printEpkDocument'

const TEST_MESSAGES: EpkPdfMessages = {
  popupBlocked: 'Popup blocked for test.',
  previewUnavailable: 'EPK preview unavailable for test.',
  printFailed: 'Print failed for test.',
}

function createPrintDocumentMock() {
  const doc = {
    open: vi.fn(),
    write: vi.fn(),
    close: vi.fn(),
    readyState: 'complete',
    images: [] as HTMLImageElement[],
    querySelectorAll: vi.fn(() => []),
    fonts: { ready: Promise.resolve() },
    defaultView: null as Window | null,
  }

  const printWindow = {
    document: doc,
    focus: vi.fn(),
    print: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn((event: string, handler: () => void) => {
      if (event === 'afterprint') {
        queueMicrotask(handler)
      }
    }),
    removeEventListener: vi.fn(),
  } as unknown as Window

  doc.defaultView = printWindow
  return { printWindow, doc, writeMock: doc.write, printMock: printWindow.print, closeMock: printWindow.close }
}

describe('printEpkDocument', () => {
  let printMock: ReturnType<typeof vi.fn>
  let closeMock: ReturnType<typeof vi.fn>
  let writeMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    const mocks = createPrintDocumentMock()
    printMock = mocks.printMock as ReturnType<typeof vi.fn>
    closeMock = mocks.closeMock as ReturnType<typeof vi.fn>
    writeMock = mocks.writeMock as ReturnType<typeof vi.fn>

    vi.stubGlobal('open', vi.fn(() => mocks.printWindow))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('throws when popups are blocked', async () => {
    vi.stubGlobal('open', vi.fn(() => null))

    const root = document.createElement('article')
    root.setAttribute('data-epk-root', 'true')
    document.body.appendChild(root)

    await expect(
      printEpkDocument({ sourceRoot: root, title: 'Test EPK', messages: TEST_MESSAGES }),
    ).rejects.toThrow(/Popup blocked/)
  })

  it('opens a print window without noopener and calls print()', async () => {
    const root = document.createElement('article')
    root.setAttribute('data-epk-root', 'true')
    root.textContent = 'EPK content'
    document.body.appendChild(root)

    await printEpkDocument({
      sourceRoot: root,
      title: 'Artist — EPK',
      orientation: 'landscape',
      messages: TEST_MESSAGES,
    })

    expect(open).toHaveBeenCalledWith('', '_blank', 'width=920,height=1200')
    expect(writeMock).toHaveBeenCalled()
    expect(printMock).toHaveBeenCalledOnce()
    expect(closeMock).toHaveBeenCalled()
    expect(writeMock.mock.calls[0]?.[0]).toContain('A4 landscape')
  })

  it('copies resolved image src and strips lazy-loading attrs in the clone', async () => {
    const root = document.createElement('article')
    root.setAttribute('data-epk-root', 'true')
    const img = document.createElement('img')
    img.setAttribute('src', '/placeholder.jpg')
    img.setAttribute('loading', 'lazy')
    img.setAttribute('srcset', '/small.jpg 1x')
    Object.defineProperty(img, 'currentSrc', {
      value: 'https://cdn.example.com/photo.webp',
      configurable: true,
    })
    root.appendChild(img)
    document.body.appendChild(root)

    await printEpkDocument({ sourceRoot: root, title: 'Test EPK', messages: TEST_MESSAGES })

    const html = writeMock.mock.calls[0]?.[0] as string
    expect(html).toContain('https://cdn.example.com/photo.webp')
    expect(html).not.toContain('loading="lazy"')
    expect(html).not.toContain('srcset=')
  })

  it('findEpkDocumentRoot prefers a connected ref', () => {
    const preferred = document.createElement('article')
    preferred.setAttribute('data-epk-root', 'true')
    document.body.appendChild(preferred)

    const other = document.createElement('article')
    other.setAttribute('data-epk-root', 'true')
    document.body.appendChild(other)

    expect(findEpkDocumentRoot(preferred)).toBe(preferred)
  })

  it('findEpkDocumentRoot prefers a visible root over a hidden force-mounted tab', () => {
    const hidden = document.createElement('article')
    hidden.setAttribute('data-epk-root', 'true')
    hidden.style.display = 'none'
    hidden.getClientRects = () => [] as unknown as DOMRectList
    document.body.appendChild(hidden)

    const visible = document.createElement('article')
    visible.setAttribute('data-epk-root', 'true')
    visible.getClientRects = () =>
      [{ width: 100, height: 100 }] as unknown as DOMRectList
    document.body.appendChild(visible)

    expect(findEpkDocumentRoot()).toBe(visible)
  })

  it('findEpkDocumentRoot falls back to hidden root when none are visible', () => {
    const hidden = document.createElement('article')
    hidden.setAttribute('data-epk-root', 'true')
    hidden.style.display = 'none'
    document.body.appendChild(hidden)

    expect(findEpkDocumentRoot()).toBe(hidden)
  })

  it('generateEpkPdfFromPreview throws when no preview is mounted', async () => {
    await expect(
      generateEpkPdfFromPreview({ artistName: 'Test Artist', messages: TEST_MESSAGES }),
    ).rejects.toThrow(/EPK preview unavailable/)
  })
})