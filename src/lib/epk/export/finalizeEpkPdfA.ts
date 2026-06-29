/**
 * Finalizes an EPK PDF for PDF/A-2b archival export with embedded output intent.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  PDFDocument,
  PDFName,
  PDFString,
  PDFHexString,
  PDFArray,
} from 'pdf-lib'
import type { EpkDocumentMetadata } from '@/lib/epk/schema/documentV2'
import { EPK_PDF_SAVE_OPTIONS } from './pdfSaveOptions'

const SRGB_ICC_PATH = join(
  process.cwd(),
  'src/lib/epk/export/assets/sRGB-IEC61966-2.1.icc',
)

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildPdfAXmp(metadata: EpkDocumentMetadata, now: Date): string {
  const title = escapeXml(metadata.title ?? 'Electronic Press Kit')
  const author = escapeXml(metadata.author ?? 'darkTunes Music Group')
  const subject = escapeXml(metadata.subject ?? 'Electronic Press Kit')
  const iso = now.toISOString()

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${author}</rdf:li></rdf:Seq></dc:creator>
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${subject}</rdf:li></rdf:Alt></dc:description>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>darkTunes EPK Builder</pdf:Producer>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>darkTunes Music Group</xmp:CreatorTool>
      <xmp:CreateDate>${iso}</xmp:CreateDate>
      <xmp:ModifyDate>${iso}</xmp:ModifyDate>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>2</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
}

function loadSrgbIccProfile(): Uint8Array {
  const bytes = readFileSync(SRGB_ICC_PATH)
  if (bytes.length < 128) {
    throw new Error('Bundled sRGB ICC profile is too small to be valid')
  }
  const header = bytes.subarray(0, 9).toString('utf8')
  if (header.startsWith('<!DOCTYPE') || header.startsWith('<html')) {
    throw new Error('Bundled sRGB ICC profile is HTML, not a binary ICC file')
  }
  if (bytes.subarray(36, 40).toString('ascii') !== 'acsp') {
    throw new Error('Bundled sRGB ICC profile is missing the acsp signature')
  }
  return new Uint8Array(bytes)
}

export async function finalizeEpkPdfA(
  pdfBytes: Uint8Array,
  metadata: EpkDocumentMetadata,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const context = pdfDoc.context
  const catalog = pdfDoc.catalog
  const now = new Date()

  catalog.set(
    PDFName.of('MarkInfo'),
    context.obj({
      Marked: true,
    }),
  )

  const iccBytes = loadSrgbIccProfile()
  const iccStream = context.stream(iccBytes, {
    Type: PDFName.of('ICCProfile'),
    N: 3,
  })
  const iccRef = context.register(iccStream)

  const outputIntent = context.obj({
    Type: PDFName.of('OutputIntent'),
    S: PDFName.of('GTS_PDFA1'),
    OutputConditionIdentifier: PDFString.of('sRGB IEC61966-2.1'),
    RegistryName: PDFString.of('http://www.color.org'),
    Info: PDFString.of('sRGB IEC61966-2.1'),
    DestOutputProfile: iccRef,
  })
  const outputIntentRef = context.register(outputIntent)
  catalog.set(PDFName.of('OutputIntents'), context.obj([outputIntentRef]))

  const xmp = buildPdfAXmp(metadata, now)
  const metadataStream = context.stream(xmp, {
    Type: PDFName.of('Metadata'),
    Subtype: PDFName.of('XML'),
  })
  const metadataRef = context.register(metadataStream)
  catalog.set(PDFName.of('Metadata'), metadataRef)

  pdfDoc.setTitle(metadata.title ?? 'Electronic Press Kit')
  pdfDoc.setAuthor(metadata.author ?? 'darkTunes Music Group')
  pdfDoc.setSubject(metadata.subject ?? 'Electronic Press Kit')
  pdfDoc.setProducer('darkTunes EPK Builder')
  pdfDoc.setCreator('darkTunes Music Group')
  pdfDoc.setCreationDate(now)
  pdfDoc.setModificationDate(now)
  if (metadata.keywords?.length) pdfDoc.setKeywords(metadata.keywords)

  const idArray = PDFArray.withContext(context)
  const docId = PDFHexString.of(
    Array.from({ length: 16 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(
      '',
    ),
  )
  idArray.push(docId)
  idArray.push(docId)
  pdfDoc.context.trailerInfo.ID = idArray

  return pdfDoc.save(EPK_PDF_SAVE_OPTIONS)
}