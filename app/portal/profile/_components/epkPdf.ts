/**
 * app/portal/profile/_components/epkPdf.ts
 *
 * Generates an Electronic Press Kit (EPK) as a downloadable PDF file.
 * Uses jsPDF (already a project dependency) for layout — bio HTML is
 * converted to plain text since jsPDF does not render HTML natively.
 *
 * Loaded via dynamic import so the ~300 kB jsPDF bundle is only fetched
 * when the user actually clicks "Download PDF".
 */

import type { EPKData } from './EPKPreview'

/** Strip HTML tags and decode common entities — used for PDF text content. */
function htmlToText(html: string): string {
  if (typeof window === 'undefined') {
    // Remove script/style blocks first, then strip remaining tags
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, '')
  }
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent ?? div.innerText ?? '').trim()
}

/**
 * Generates and downloads an EPK as a PDF file.
 *
 * @param data  EPK content — bios, contacts, links, label branding.
 */
export async function generateEpkPdf(data: EPKData): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const PAGE_W = 210
  const MARGIN = 20
  const CONTENT_W = PAGE_W - MARGIN * 2
  const LABEL_COLOR: [number, number, number] = [73, 54, 135]   // brand primary
  const TEXT_COLOR:  [number, number, number] = [240, 240, 240]
  const MUTED_COLOR: [number, number, number] = [160, 160, 180]
  const BG_COLOR:    [number, number, number] = [30,  30,  30 ]

  // Background fill for first page
  doc.setFillColor(...BG_COLOR)
  doc.rect(0, 0, PAGE_W, 297, 'F')

  let y = MARGIN

  // ── Header band ───────────────────────────────────────────────────────────
  doc.setFillColor(...LABEL_COLOR)
  doc.roundedRect(MARGIN, y, CONTENT_W, 30, 3, 3, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(200, 190, 240)
  doc.text('ELECTRONIC PRESS KIT', MARGIN + 6, y + 8)

  doc.setFontSize(20)
  doc.setTextColor(...TEXT_COLOR)
  doc.text(data.artistName, MARGIN + 6, y + 20)

  if (data.genres) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED_COLOR)
    doc.text(data.genres, MARGIN + 6, y + 27)
  }

  y += 40

  // ── Press quote ────────────────────────────────────────────────────────────
  if (data.pressQuote) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED_COLOR)
    const lines = doc.splitTextToSize(`"${data.pressQuote}"`, CONTENT_W)
    doc.text(lines, MARGIN, y)
    y += (lines.length * 5) + 6
  }

  // ── Section helper ─────────────────────────────────────────────────────────
  function addSection(title: string, content: string) {
    const trimmed = content.trim()
    if (!trimmed) return

    // Page break if near the bottom (leave 20 mm for footer)
    if (y > 265) {
      doc.addPage()
      doc.setFillColor(...BG_COLOR)
      doc.rect(0, 0, PAGE_W, 297, 'F')
      y = MARGIN
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...LABEL_COLOR)
    doc.text(title.toUpperCase(), MARGIN, y)
    y += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_COLOR)
    const lines = doc.splitTextToSize(trimmed, CONTENT_W)
    doc.text(lines, MARGIN, y)
    y += (lines.length * 5) + 7
  }

  // ── Biographies ───────────────────────────────────────────────────────────
  if (data.bioShort)  addSection('Short Bio',  htmlToText(data.bioShort))
  if (data.bioMedium) addSection('Bio',         htmlToText(data.bioMedium))
  if (data.bioLong)   addSection('Full Bio',    htmlToText(data.bioLong))

  // ── Info strip ────────────────────────────────────────────────────────────
  const infoLines: string[] = []
  if (data.foundingYear) infoLines.push(`Founded: ${data.foundingYear}`)
  if (data.hometown)     infoLines.push(`Origin: ${data.hometown}`)
  if (infoLines.length > 0) addSection('Info', infoLines.join('   ·   '))

  // ── Contacts ──────────────────────────────────────────────────────────────
  const contactLines: string[] = []
  if (data.bookingContact) contactLines.push(`Booking: ${data.bookingContact}`)
  if (data.pressContact)   contactLines.push(`Press:   ${data.pressContact}`)
  if (contactLines.length > 0) addSection('Contact', contactLines.join('\n'))

  // ── Links ─────────────────────────────────────────────────────────────────
  const linkLines = [
    data.websiteUrl    && `Website:     ${data.websiteUrl}`,
    data.spotifyUrl    && `Spotify:     ${data.spotifyUrl}`,
    data.appleMusicUrl && `Apple Music: ${data.appleMusicUrl}`,
    data.instagramUrl  && `Instagram:   ${data.instagramUrl}`,
    data.youtubeUrl    && `YouTube:     ${data.youtubeUrl}`,
    data.tiktokUrl     && `TikTok:      ${data.tiktokUrl}`,
    data.facebookUrl   && `Facebook:    ${data.facebookUrl}`,
    data.soundcloudUrl && `SoundCloud:  ${data.soundcloudUrl}`,
    data.bandcampUrl   && `Bandcamp:    ${data.bandcampUrl}`,
  ].filter(Boolean) as string[]
  if (linkLines.length > 0) addSection('Links', linkLines.join('\n'))

  // ── Footer on every page ──────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  const labelText = (data.labelName ?? 'Electronic Press Kit').toUpperCase()
  const year = String(new Date().getFullYear())

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFillColor(40, 40, 40)
    doc.rect(0, 283, PAGE_W, 14, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...LABEL_COLOR)
    doc.text(labelText, MARGIN, 292)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED_COLOR)
    doc.text(year, PAGE_W - MARGIN, 292, { align: 'right' })
  }

  const safeName = data.artistName.replace(/[^a-z0-9]/gi, '-').toLowerCase()
  doc.save(`epk-${safeName}.pdf`)
}
