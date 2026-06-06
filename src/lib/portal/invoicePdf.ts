/**
 * src/lib/portal/invoicePdf.ts
 *
 * Server-safe PDF invoice generator using jspdf + jspdf-autotable.
 *
 * No DOM Image API is used — only text and table primitives, which are
 * safe to call in a Node.js / Edge runtime (Next.js API route).
 *
 * Returns a Uint8Array of the PDF binary, ready for upload to R2.
 */

// jspdf works in Node.js when no image/canvas APIs are used
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { jsPDF } = require('jspdf')
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('jspdf-autotable')

export interface InvoiceLineItem {
  description: string
  qty: number
  unitPriceCents: number
}

export interface InvoicePdfOptions {
  invoiceNumber: string
  issuedDate: string   // ISO date string
  dueDate: string      // ISO date string
  artistName: string
  artistEmail?: string
  clientName: string
  clientEmail?: string
  clientAddress?: string
  lineItems: InvoiceLineItem[]
  currency: string
  taxRatePct: number
}

function formatCurrency(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency })
}

/**
 * Generate a PDF invoice and return the raw bytes as a Uint8Array.
 */
export function generateInvoicePdf(opts: InvoicePdfOptions): Uint8Array {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = new (jsPDF as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const BG = '#000000'
  const FG = '#FFFFFF'
  const ACCENT = '#F0F0F0'
  const MUTED = '#888888'
  const PAGE_W = 210
  const MARGIN = 20

  // ── Background ──────────────────────────────────────────────────────────
  doc.setFillColor(BG)
  doc.rect(0, 0, PAGE_W, 297, 'F')

  // ── Header ───────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(FG)
  doc.text('darkTunes', MARGIN, 24)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(MUTED)
  doc.text('Music Group', MARGIN, 30)

  // ── Invoice title ────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(FG)
  doc.text('INVOICE', PAGE_W - MARGIN, 24, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(MUTED)
  doc.text(opts.invoiceNumber, PAGE_W - MARGIN, 30, { align: 'right' })

  // ── Divider ───────────────────────────────────────────────────────────────
  doc.setDrawColor(ACCENT)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, 36, PAGE_W - MARGIN, 36)

  // ── From / To block ───────────────────────────────────────────────────────
  let y = 44
  doc.setFontSize(8)
  doc.setTextColor(MUTED)
  doc.text('FROM', MARGIN, y)
  doc.text('TO', 110, y)

  y += 5
  doc.setFontSize(10)
  doc.setTextColor(FG)
  doc.text(opts.artistName, MARGIN, y)
  doc.text(opts.clientName, 110, y)

  if (opts.artistEmail) {
    y += 5
    doc.setFontSize(9)
    doc.setTextColor(MUTED)
    doc.text(opts.artistEmail, MARGIN, y)
  }
  if (opts.clientEmail || opts.clientAddress) {
    doc.setFontSize(9)
    doc.setTextColor(MUTED)
    if (opts.clientEmail) doc.text(opts.clientEmail, 110, y)
    if (opts.clientAddress) {
      y += 5
      doc.text(opts.clientAddress, 110, y)
    }
  }

  // ── Dates ─────────────────────────────────────────────────────────────────
  y += 10
  doc.setFontSize(9)
  doc.setTextColor(MUTED)
  doc.text(`Issued: ${opts.issuedDate}`, MARGIN, y)
  doc.text(`Due: ${opts.dueDate}`, MARGIN + 60, y)

  // ── Line items table ──────────────────────────────────────────────────────
  const tableHead = [['Description', 'Qty', 'Unit Price', 'Total']]
  const tableBody = opts.lineItems.map((item) => [
    item.description,
    String(item.qty),
    formatCurrency(item.unitPriceCents, opts.currency),
    formatCurrency(item.qty * item.unitPriceCents, opts.currency),
  ])

  const subtotalCents = opts.lineItems.reduce((s, i) => s + i.qty * i.unitPriceCents, 0)
  const taxCents = Math.round(subtotalCents * (opts.taxRatePct / 100))
  const totalCents = subtotalCents + taxCents

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(doc as any).autoTable({
    startY: y + 8,
    head: tableHead,
    body: tableBody,
    margin: { left: MARGIN, right: MARGIN },
    headStyles: {
      fillColor: [20, 20, 20],
      textColor: [200, 200, 200],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fillColor: [10, 10, 10],
      textColor: [220, 220, 220],
      fontSize: 9,
      lineColor: [40, 40, 40],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 15, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
  })

  // ── Totals block ──────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY: number = (doc as any).lastAutoTable.finalY + 6
  const totalsX = PAGE_W - MARGIN - 70
  const valX = PAGE_W - MARGIN

  doc.setFontSize(9)
  doc.setTextColor(MUTED)
  doc.text('Subtotal', totalsX, finalY)
  doc.setTextColor(FG)
  doc.text(formatCurrency(subtotalCents, opts.currency), valX, finalY, { align: 'right' })

  doc.setTextColor(MUTED)
  doc.text(`Tax (${opts.taxRatePct}%)`, totalsX, finalY + 6)
  doc.setTextColor(FG)
  doc.text(formatCurrency(taxCents, opts.currency), valX, finalY + 6, { align: 'right' })

  doc.setDrawColor(ACCENT)
  doc.line(totalsX, finalY + 9, valX, finalY + 9)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(FG)
  doc.text('Total', totalsX, finalY + 14)
  doc.text(formatCurrency(totalCents, opts.currency), valX, finalY + 14, { align: 'right' })

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(MUTED)
  doc.text('darkTunes Music Group — artist.portal', MARGIN, 285)
  doc.text(opts.invoiceNumber, PAGE_W - MARGIN, 285, { align: 'right' })

  return doc.output('arraybuffer') as Uint8Array
}
