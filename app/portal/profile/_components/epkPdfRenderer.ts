import type { RefObject } from 'react'
import html2canvas from 'html2canvas'
import type { EPKData } from './EPKPreview'

const MM_OVERLAP_GUARD = 5

interface PageSlice {
  startPx: number
  endPx: number
}

function getOrientation(data: EPKData): 'portrait' | 'landscape' {
  return data.epkOrientation === 'landscape' ? 'landscape' : 'portrait'
}

function getTargetNode(containerRef: RefObject<HTMLElement | null>): HTMLElement | null {
  return containerRef.current ?? document.getElementById('epk-document-root')
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

  if (wrapper) wrapper.style.padding = '0'
  target.style.margin = '0'

  try {
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: null,
      logging: false,
      scrollX: 0,
      scrollY: -window.scrollY,
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
      const imageData = sliceCanvas.toDataURL('image/jpeg', 0.82)
      if (pageIndex > 0) doc.addPage()
      doc.addImage(imageData, 'JPEG', 0, 0, pageWidthMm, imageHeightMm, undefined, 'MEDIUM')
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
    if (wrapper) wrapper.style.padding = originalWrapperPadding
  }
}
