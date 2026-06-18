import type { RefObject } from 'react'
import html2canvas from 'html2canvas'
import type { EPKData } from './EPKPreview'

const MM_OVERLAP_GUARD = 5

interface PageSlice {
  startPx: number
  endPx: number
}

interface SrcsetCandidate {
  url: string
  score: number
}

function getOrientation(data: EPKData): 'portrait' | 'landscape' {
  return data.epkOrientation === 'landscape' ? 'landscape' : 'portrait'
}

function getTargetNode(containerRef: RefObject<HTMLElement | null>): HTMLElement | null {
  return containerRef.current ?? document.getElementById('epk-document-root')
}

function resolveImageUrl(url: string): string {
  try {
    const absoluteUrl = new URL(url, window.location.href)
    if (absoluteUrl.pathname === '/_next/image') {
      const originalUrl = absoluteUrl.searchParams.get('url')
      if (originalUrl) {
        return new URL(originalUrl, window.location.href).toString()
      }
    }
    return absoluteUrl.toString()
  } catch {
    return url
  }
}

function parseSrcsetCandidate(candidate: string): SrcsetCandidate | null {
  const [url, descriptor] = candidate.trim().split(/\s+/, 2)
  if (!url) return null

  const score = descriptor?.endsWith('w')
    ? Number.parseInt(descriptor, 10)
    : descriptor?.endsWith('x')
      ? Math.round(Number.parseFloat(descriptor) * 1000)
      : 0

  return { url: resolveImageUrl(url), score: Number.isFinite(score) ? score : 0 }
}

function getResolvedImageSource(img: HTMLImageElement): string | null {
  const srcset = img.getAttribute('srcset')
  if (srcset) {
    const bestCandidate = srcset
      .split(',')
      .map(parseSrcsetCandidate)
      .filter((candidate): candidate is SrcsetCandidate => candidate !== null)
      .sort((a, b) => b.score - a.score)[0]

    if (bestCandidate) return bestCandidate.url
  }

  const src = img.getAttribute('src') ?? img.currentSrc ?? img.src
  return src ? resolveImageUrl(src) : null
}

function resetCloneScroll(node: HTMLElement): void {
  let current: HTMLElement | null = node
  while (current) {
    current.scrollTop = 0
    current.scrollLeft = 0
    current = current.parentElement
  }
}

function prepareClonedImages(clonedTarget: HTMLElement): void {
  clonedTarget.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    const resolvedSource = getResolvedImageSource(img)
    img.crossOrigin = 'anonymous'
    img.removeAttribute('srcset')
    if (resolvedSource) {
      img.src = resolvedSource
    }
  })
}

function createPageCanvas(source: HTMLCanvasElement, startY: number, height: number): HTMLCanvasElement {
  const pageCanvas = document.createElement('canvas')
  pageCanvas.width = source.width
  pageCanvas.height = height
  const ctx = pageCanvas.getContext('2d')
  if (!ctx) throw new Error('Failed to create PDF canvas context')
  ctx.drawImage(
    source,
    0,
    startY,
    source.width,
    height,
    0,
    0,
    source.width,
    height,
  )
  return pageCanvas
}

function collectSlices(canvas: HTMLCanvasElement, pageWidthMm: number, pageHeightMm: number): PageSlice[] {
  const pxPerMm = canvas.width / pageWidthMm
  const pageHeightPx = Math.floor(pageHeightMm * pxPerMm)
  const overlapPx = Math.max(1, Math.floor(MM_OVERLAP_GUARD * pxPerMm))

  const slices: PageSlice[] = []
  let startPx = 0
  while (startPx < canvas.height) {
    const endPx = Math.min(canvas.height, startPx + pageHeightPx + overlapPx)
    slices.push({ startPx, endPx })
    if (endPx >= canvas.height) break
    startPx = endPx - overlapPx
  }
  return slices
}

async function loadJsPdf() {
  const { jsPDF } = await import('jspdf')
  return jsPDF
}

export async function generateEpkPdf(
  data: EPKData,
  containerRef: RefObject<HTMLElement | null>,
): Promise<void> {
  const target = getTargetNode(containerRef)
  if (!target) throw new Error('EPK document node not found')

  const wrapper = target.parentElement
  const originalWrapperPadding = wrapper?.style.padding ?? ''
  const originalTargetMargin = target.style.margin
  const originalAspectRatio = target.style.aspectRatio
  const computedBackgroundColor = window.getComputedStyle(target).backgroundColor
  const backgroundColor = computedBackgroundColor
  && computedBackgroundColor !== 'rgba(0, 0, 0, 0)'
  && computedBackgroundColor !== 'transparent'
    ? computedBackgroundColor
    : '#101010'

  if (wrapper) wrapper.style.padding = '0'
  target.style.margin = '0'
  target.style.aspectRatio = 'unset'

  try {
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor,
      logging: false,
      imageTimeout: 0,
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
      onclone: (clonedDocument) => {
        const clonedTarget = target.id
          ? clonedDocument.getElementById(target.id)
          : clonedDocument.querySelector<HTMLElement>('.epk-document')
        if (!clonedTarget) return

        clonedDocument.documentElement.scrollTop = 0
        clonedDocument.documentElement.scrollLeft = 0
        clonedDocument.body.scrollTop = 0
        clonedDocument.body.scrollLeft = 0
        resetCloneScroll(clonedTarget)
        prepareClonedImages(clonedTarget)
      },
    })

    const jsPDF = await loadJsPdf()
    const orientation = getOrientation(data)
    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
      compress: true,
      putOnlyUsedFonts: true,
    })

    const pageWidthMm = doc.internal.pageSize.getWidth()
    const pageHeightMm = doc.internal.pageSize.getHeight()
    const mmPerPx = pageWidthMm / canvas.width
    const slices = collectSlices(canvas, pageWidthMm, pageHeightMm)

    slices.forEach((slice, pageIndex) => {
      const sliceCanvas = createPageCanvas(canvas, slice.startPx, slice.endPx - slice.startPx)
      const imageHeightMm = sliceCanvas.height * mmPerPx
      const imageData = sliceCanvas.toDataURL('image/jpeg', 0.92)
      if (pageIndex > 0) doc.addPage()
      doc.addImage(imageData, 'JPEG', 0, 0, pageWidthMm, imageHeightMm, undefined, 'FAST')
    })

    const rootRect = target.getBoundingClientRect()
    const anchors = Array.from(target.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .filter((anchor) => Boolean(anchor.href))

    anchors.forEach((anchor) => {
      const href = anchor.href
      const rect = anchor.getBoundingClientRect()
      const xPx = rect.left - rootRect.left
      const yPx = rect.top - rootRect.top
      const widthPx = rect.width
      const heightPx = rect.height
      if (widthPx <= 0 || heightPx <= 0) return

      slices.forEach((slice, index) => {
        const overlapTop = Math.max(yPx, slice.startPx)
        const overlapBottom = Math.min(yPx + heightPx, slice.endPx)
        if (overlapBottom <= overlapTop) return

        const xMm = xPx * mmPerPx
        const yMm = (overlapTop - slice.startPx) * mmPerPx
        const widthMm = widthPx * mmPerPx
        const heightMm = (overlapBottom - overlapTop) * mmPerPx
        if (widthMm <= 0 || heightMm <= 0) return

        doc.setPage(index + 1)
        doc.link(xMm, yMm, widthMm, heightMm, { url: href })
      })
    })

    const safeName = data.artistName.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    doc.save(`epk-${safeName}.pdf`)
  } finally {
    target.style.margin = originalTargetMargin
    target.style.aspectRatio = originalAspectRatio
    if (wrapper) wrapper.style.padding = originalWrapperPadding
  }
}
