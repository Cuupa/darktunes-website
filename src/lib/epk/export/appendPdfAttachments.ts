/**
 * src/lib/epk/export/appendPdfAttachments.ts
 *
 * Appends rider PDF pages to the generated EPK export.
 */

import { PDFDocument } from 'pdf-lib'
import { EPK_PDF_SAVE_OPTIONS } from './pdfSaveOptions'
import { fetchRemoteBytes } from './fetchRemoteBytes'

export async function appendPdfAttachments(
  mainBytes: Uint8Array,
  attachmentUrls: string[] | undefined,
  r2PublicUrl?: string,
): Promise<Uint8Array> {
  const urls = (attachmentUrls ?? []).filter(Boolean)
  if (urls.length === 0) return mainBytes

  const mainDoc = await PDFDocument.load(mainBytes)

  for (const url of urls) {
    const bytes = await fetchRemoteBytes(url, r2PublicUrl, 20_000)
    if (!bytes) continue

    try {
      const attachment = await PDFDocument.load(bytes)
      const copied = await mainDoc.copyPages(attachment, attachment.getPageIndices())
      for (const page of copied) {
        mainDoc.addPage(page)
      }
    } catch {
      // Skip corrupt or encrypted rider PDFs.
    }
  }

  return mainDoc.save(EPK_PDF_SAVE_OPTIONS)
}