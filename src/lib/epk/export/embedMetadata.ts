/**
 * src/lib/epk/export/embedMetadata.ts
 *
 * Embeds PDF document metadata via pdf-lib.
 */

import type { PDFDocument } from 'pdf-lib'
import type { EpkDocumentMetadata } from '@/lib/epk/schema/documentV2'

export function embedPdfMetadata(pdfDoc: PDFDocument, metadata: EpkDocumentMetadata): void {
  if (metadata.title) pdfDoc.setTitle(metadata.title)
  if (metadata.author) pdfDoc.setAuthor(metadata.author)
  if (metadata.subject) pdfDoc.setSubject(metadata.subject)
  if (metadata.keywords?.length) pdfDoc.setKeywords(metadata.keywords)
  pdfDoc.setProducer('darkTunes EPK Builder')
  pdfDoc.setCreator('darkTunes Music Group')
  pdfDoc.setCreationDate(new Date())
  pdfDoc.setModificationDate(new Date())
}