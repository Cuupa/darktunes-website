/**
 * src/lib/epk/export/addPdfBookmarks.ts
 *
 * Adds PDF document outline (bookmarks) from EPK page names via pdf-lib context.
 */

import { PDFDocument, PDFName, PDFString } from 'pdf-lib'
import { EPK_PDF_SAVE_OPTIONS } from './pdfSaveOptions'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'

export async function addPdfBookmarksFromPages(
  pdfBytes: Uint8Array,
  document: EpkDocumentV2,
): Promise<Uint8Array> {
  const namedPages = document.pages
    .map((page, index) => ({ title: page.name?.trim(), index }))
    .filter((entry): entry is { title: string; index: number } => Boolean(entry.title))

  if (namedPages.length === 0) return pdfBytes

  try {
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const pages = pdfDoc.getPages()
    const context = pdfDoc.context

    const itemDicts = namedPages.map((entry) => {
      const destArray = context.obj([pages[entry.index].ref, PDFName.of('Fit')])
      return context.obj({
        Title: PDFString.of(entry.title),
        Dest: destArray,
      })
    })

    const outlinesDict = context.obj({
      Type: PDFName.of('Outlines'),
      Count: itemDicts.length,
    })
    const outlinesRef = context.register(outlinesDict)

    const itemRefs = itemDicts.map((dict) => {
      dict.set(PDFName.of('Parent'), outlinesRef)
      return context.register(dict)
    })

    for (let i = 0; i < itemRefs.length; i += 1) {
      if (i > 0) itemDicts[i].set(PDFName.of('Prev'), itemRefs[i - 1])
      if (i < itemRefs.length - 1) itemDicts[i].set(PDFName.of('Next'), itemRefs[i + 1])
    }

    outlinesDict.set(PDFName.of('First'), itemRefs[0])
    outlinesDict.set(PDFName.of('Last'), itemRefs[itemRefs.length - 1])
    pdfDoc.catalog.set(PDFName.of('Outlines'), outlinesRef)

    return pdfDoc.save(EPK_PDF_SAVE_OPTIONS)
  } catch {
    return pdfBytes
  }
}