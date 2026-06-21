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

  // Appending to the DOM is required in Firefox and some Chromium versions
  // for a programmatic click on an <a download> element to trigger a save.
  try {
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)

    // Delay revocation on success so the browser has time to start the download
    // before the blob URL is invalidated. Revoking synchronously in a finally
    // block caused the browser to fail fetching the blob (0 B transferred).
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  } catch (err) {
    // Revoke immediately on error to avoid a memory leak (the download never
    // started so the blob URL will not be used).
    URL.revokeObjectURL(url)
    throw err
  }
}
