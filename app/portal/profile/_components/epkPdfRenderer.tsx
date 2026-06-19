/**
 * app/portal/profile/_components/epkPdfRenderer.tsx
 *
 * Generates a native, vector-based PDF using @react-pdf/renderer and triggers
 * a browser download. No DOM capture, no canvas snapshot — text is selectable
 * and file sizes are minimal.
 */

import { createElement } from 'react'
import type { ReactElement } from 'react'
import { pdf } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import type { EPKData } from './EPKPreview'
import { EPKPdfDocument } from './EPKPdfDocument'

export async function generateEpkPdf(data: EPKData): Promise<void> {
  const element = createElement(EPKPdfDocument, { data }) as ReactElement<DocumentProps>
  const blob = await pdf(element).toBlob()

  const safeName = data.artistName.replace(/[^a-z0-9]/gi, '-').toLowerCase()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `epk-${safeName}.pdf`
  try {
    // Appending to the DOM is required in Firefox and some Chromium versions
    // for a programmatic click on an <a download> element to trigger a save.
    document.body.appendChild(anchor)
    anchor.click()
  } finally {
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }
}
