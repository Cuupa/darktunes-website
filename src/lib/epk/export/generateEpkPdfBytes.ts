/**
 * src/lib/epk/export/generateEpkPdfBytes.ts
 *
 * Public entry point for server-side EPK PDF generation.
 */

import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import { parseEpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import { appendPdfAttachments } from './appendPdfAttachments'
import { addPdfBookmarksFromPages } from './addPdfBookmarks'
import { renderDocumentToPdf } from './renderDocumentToPdf'
import { finalizeEpkPdfA } from './finalizeEpkPdfA'

export interface GenerateEpkPdfBytesInput {
  document: EpkDocumentV2 | unknown
  attachmentUrls?: string[]
}

export async function generateEpkPdfBytes(input: GenerateEpkPdfBytesInput): Promise<Uint8Array> {
  const document = parseEpkDocumentV2(input.document)
  const r2PublicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL
  const mainBytes = await renderDocumentToPdf({ document, r2PublicUrl })
  const withBookmarks = await addPdfBookmarksFromPages(mainBytes, document)
  const withAttachments = await appendPdfAttachments(
    withBookmarks,
    input.attachmentUrls,
    r2PublicUrl,
  )
  return finalizeEpkPdfA(withAttachments, document.metadata)
}