import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import html2canvas from 'html2canvas'
import { generateEpkPdf } from '../../../app/portal/profile/_components/epkPdfRenderer'
import type { EPKData } from '../../../app/portal/profile/_components/EPKPreview'

const {
  addImageMock,
  _addPageMock,
  _setPageMock,
  linkMock,
  saveMock,
  jsPdfMock,
} = vi.hoisted(() => {
  const addImageMock = vi.fn()
  const addPageMock = vi.fn()
  const setPageMock = vi.fn()
  const linkMock = vi.fn()
  const saveMock = vi.fn()
  const jsPdfMock = vi.fn(function JsPdfMock() {
    return {
      internal: {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297,
        },
      },
      addImage: addImageMock,
      addPage: addPageMock,
      setPage: setPageMock,
      link: linkMock,
      save: saveMock,
    }
  })

  return { addImageMock, _addPageMock: addPageMock, _setPageMock: setPageMock, linkMock, saveMock, jsPdfMock }
})

vi.mock('html2canvas', () => ({
  default: vi.fn(),
}))

vi.mock('jspdf', () => ({
  jsPDF: jsPdfMock,
}))

function createMockCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

describe('generateEpkPdf', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  const originalToDataUrl = HTMLCanvasElement.prototype.toDataURL

  beforeEach(() => {
    vi.clearAllMocks()

    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,mock')

    Object.defineProperty(window, 'scrollX', { value: 18, configurable: true })
    Object.defineProperty(window, 'scrollY', { value: 24, configurable: true })
  })

  afterAll(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext
    HTMLCanvasElement.prototype.toDataURL = originalToDataUrl
  })

  it('uses sharpened capture options, rewrites cloned image sources, and restores aspect ratio', async () => {
    const target = document.createElement('article')
    target.id = 'epk-document-root'
    target.className = 'epk-document'
    target.style.aspectRatio = '210 / 297'
    target.style.margin = '12px'
    target.style.backgroundColor = 'rgb(16, 16, 16)'
    target.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 1000,
      height: 1400,
      right: 1000,
      bottom: 1400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })) as typeof target.getBoundingClientRect

    const wrapper = document.createElement('div')
    wrapper.style.padding = '24px'
    wrapper.appendChild(target)

    const nextImage = document.createElement('img')
    nextImage.setAttribute('src', '/_next/image?url=https%3A%2F%2Fcdn.example.com%2Fphoto.webp&w=3840&q=75')
    nextImage.setAttribute(
      'srcset',
      '/_next/image?url=https%3A%2F%2Fcdn.example.com%2Fphoto.webp&w=640&q=75 640w, /_next/image?url=https%3A%2F%2Fcdn.example.com%2Fphoto.webp&w=3840&q=75 3840w',
    )
    target.appendChild(nextImage)

    const anchor = document.createElement('a')
    anchor.href = 'https://darktunes.com'
    anchor.textContent = 'darkTunes'
    anchor.getBoundingClientRect = vi.fn(() => ({
      left: 100,
      top: 150,
      width: 120,
      height: 40,
      right: 220,
      bottom: 190,
      x: 100,
      y: 150,
      toJSON: () => ({}),
    })) as typeof anchor.getBoundingClientRect
    target.appendChild(anchor)

    document.body.appendChild(wrapper)

    ;(html2canvas as unknown as Mock).mockImplementation(async (_node, options) => {
      const clonedDocument = document.implementation.createHTMLDocument('clone')
      const clonedTarget = target.cloneNode(true) as HTMLElement
      clonedDocument.body.appendChild(clonedTarget)
      options.onclone?.(clonedDocument)

      const clonedImage = clonedTarget.querySelector('img')
      expect(clonedImage?.crossOrigin).toBe('anonymous')
      expect(clonedImage?.getAttribute('srcset')).toBeNull()
      expect(clonedImage?.src).toBe('https://cdn.example.com/photo.webp')

      return createMockCanvas(2100, 2800)
    })

    const data: EPKData = {
      artistName: 'Test Artist',
      epkOrientation: 'portrait',
    }

    await generateEpkPdf(data, { current: target })

    expect(html2canvas).toHaveBeenCalledWith(
      target,
      expect.objectContaining({
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: 'rgb(16, 16, 16)',
        imageTimeout: 0,
        scrollX: -18,
        scrollY: -24,
        onclone: expect.any(Function),
      }),
    )
    expect(target.style.aspectRatio).toBe('210 / 297')
    expect(target.style.margin).toBe('12px')
    expect(wrapper.style.padding).toBe('24px')
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.92)
    expect(addImageMock).toHaveBeenCalledWith(
      'data:image/jpeg;base64,mock',
      'JPEG',
      0,
      0,
      210,
      280,
      undefined,
      'FAST',
    )
    expect(linkMock).toHaveBeenCalledWith(10, 15, 12, 4, { url: 'https://darktunes.com/' })
    expect(saveMock).toHaveBeenCalledWith('epk-test-artist.pdf')
  })

  it('falls back to the default background color when the target is transparent', async () => {
    const target = document.createElement('article')
    target.id = 'epk-document-root'
    target.style.backgroundColor = 'transparent'
    document.body.appendChild(target)

    ;(html2canvas as unknown as Mock).mockResolvedValue(createMockCanvas(2100, 2800))

    await generateEpkPdf(
      {
        artistName: 'Transparent Artist',
        epkOrientation: 'portrait',
      },
      { current: target },
    )

    expect(html2canvas).toHaveBeenCalledWith(
      target,
      expect.objectContaining({
        backgroundColor: '#101010',
      }),
    )
  })
})
