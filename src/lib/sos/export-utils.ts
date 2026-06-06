import { jsPDF, GState } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { SafeProcessedArtistData, LabelInfo, PdfExportSettings, LabelArtist, CompilationFilter, AppDefaults, EmailConfig } from './types'
import { resolveTemplate } from './utils'
import { APP_CREDITS, APP_LOGO, APP_NAME } from '@/config/softwareBranding'

/** Default PDF export settings — all major sections enabled, cover letter off. */
const DEFAULT_PDF_SETTINGS: PdfExportSettings = {
  includeReleaseBreakdown: true,
  includePlatformBreakdown: true,
  includeCountryBreakdown: false,
  includeMonthlyBreakdown: false,
  includeEmailCoverLetter: false,
  hideCompilationsInStatement: true,
  includePieChart: true,
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function safeFinite(value: number): number {
  return isFinite(value) ? value : 0
}

/**
 * Returns true when a release row matches any active compilation filter.
 * Matches by filter type, mirroring the core processing logic.
 */
function isCompilationRelease(
  release: Pick<SafeProcessedArtistData['releaseBreakdown'][number], 'releaseTitle' | 'upcEan' | 'catalogNumber'>,
  compilationFilters: CompilationFilter[]
): boolean {
  if (compilationFilters.length === 0) return false
  const title = release.releaseTitle.toLowerCase()
  const upcEan = release.upcEan.toLowerCase()
  const catalogNumber = release.catalogNumber.toLowerCase()
  return compilationFilters.some(cf => {
    const identifier = cf.identifier.toLowerCase()
    if (cf.type === 'title') return title.includes(identifier)
    if (cf.type === 'ean') return upcEan === identifier
    return catalogNumber === identifier
  })
}

/**
 * Loads an image from a data URL and returns its natural pixel dimensions.
 * Resolves with null if the image fails to load (e.g. corrupted data).
 */
async function resolveImageDimensions(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/**
 * Scales image dimensions to fit within a bounding box of `maxWidth × maxHeight`
 * while preserving the original aspect ratio (object-contain semantics).
 */
function computeFitDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number
): { w: number; h: number } {
  const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight)
  return { w: naturalWidth * scale, h: naturalHeight * scale }
}

/**
 * Maximum label logo width in mm: fills the right third of an A4 page (210/3 = 70mm)
 * minus the right margin (20mm), giving 50mm of usable header space.
 */
const LABEL_LOGO_MAX_WIDTH_MM = 50

/**
 * Maximum label logo height in mm: constrains the logo to remain within the page
 * header area while the width expands to fill the right third.
 */
const LABEL_LOGO_MAX_HEIGHT_MM = 30

/** Size of the software branding logo rendered in the footer of every page (mm). */
const APP_LOGO_FOOTER_SIZE_MM = 6

/**
 * Horizontal offset (mm) applied so the footer logo extends slightly beyond the
 * left margin, visually anchoring it to the page edge.
 */
const FOOTER_LOGO_LEFT_OFFSET_MM = 4

/**
 * Vertical nudge (mm) applied to the footer logo so its baseline aligns with the
 * Row 2 text baseline rather than sitting above it.
 */
const FOOTER_LOGO_VERTICAL_NUDGE_MM = 1

/** Distance in mm between the bottom edge of the page and the Row 2 footer baseline. */
const FOOTER_BOTTOM_MARGIN_MM = 6

/** Vertical spacing in mm between footer Row 1 (bank/contact info) and Row 2. */
const FOOTER_ROW_SPACING_MM = 6

/**
 * Fraction of the total page width reserved for the left footer text (bank / contact
 * info). Kept below 0.6 so the text never reaches the center-aligned credits on Row 2.
 */
const FOOTER_TEXT_WIDTH_RATIO = 0.6

/**
 * Total vertical space in mm reserved at the bottom of every page for the two-row
 * footer. Applied as a `bottom` margin on every `autoTable` call so tables page-break
 * before entering the footer zone, and used to compute the cover-letter page-break
 * threshold instead of the previous hard-coded magic number (280 mm).
 *
 * Composed of:
 *   FOOTER_BOTTOM_MARGIN_MM (6 mm) — gap between Row 2 baseline and page edge
 * + FOOTER_ROW_SPACING_MM   (6 mm) — gap between Row 1 and Row 2 baselines
 * + 6 mm safety buffer             — one average line-height (≈ font-size 9 pt ≈ 3 mm
 *                                    plus leading) to ensure text on the last
 *                                    content line never visually overlaps Row 1.
 */
const FOOTER_RESERVED_MM = FOOTER_BOTTOM_MARGIN_MM + FOOTER_ROW_SPACING_MM + 6

/**
 * Maximum rows rendered per breakdown table (releases, platforms, countries, months).
 * Prevents memory exhaustion in the browser for artists with extremely large catalogues
 * that would otherwise produce documents exceeding 10 pages per section.
 */
const MAX_BREAKDOWN_ROWS = 500

/**
 * Minimum vertical space in mm that must remain on the current page before a section
 * heading is rendered inline. Must accommodate the heading line (≈5 mm), the autoTable
 * column-header row (≈8 mm) and at least two data rows (≈12 mm) so the heading is
 * never orphaned at the bottom of a page when autoTable opens a fresh page for the
 * table body. If less space is available, the heading is skipped so autoTable's own
 * repeated column header carries the visual separation instead.
 */
const MIN_SPACE_FOR_SECTION_HEADING_MM = 60

/** Font size (pt) for table footnotes (e.g. "N more countries not shown"). */
const FOOTNOTE_FONT_SIZE_PT = 7
/** RGB colour applied to table footnote text. */
const FOOTNOTE_TEXT_COLOR_RGB: [number, number, number] = [120, 120, 140]
/** RGB colour applied to negative payout rows in the waterfall table. */
const NEGATIVE_PAYOUT_COLOR_RGB: [number, number, number] = [200, 0, 0]

/**
 * Placeholder string that is substituted by jsPDF's `putTotalPages()` call at the
 * very end of `buildPDF`, after every page has been generated. Using this two-pass
 * approach guarantees that "Page N of M" footers show the correct final page count M
 * on every page, not just the last one (which would be the result of reading
 * `getNumberOfPages()` inside the per-page `didDrawPage` callback).
 */
const TOTAL_PAGES_PLACEHOLDER = '{total_pages}'

type DigitalSourceSplit = {
  label: 'Believe' | 'Bandcamp' | 'Other'
  percentage: number
  hasRevenue: boolean
}

function buildDigitalSplitLabel(
  digitalFallbackPercentage: number,
  sources: DigitalSourceSplit[]
): string {
  const activeSources = sources.filter(source => source.hasRevenue)
  if (activeSources.length === 0) {
    return `× Digital Split (${digitalFallbackPercentage}%)`
  }

  const uniquePercentages = new Set(activeSources.map(source => source.percentage))
  if (uniquePercentages.size <= 1) {
    return `× Digital Split (${activeSources[0].percentage}%)`
  }

  const activeOther = activeSources.find(source => source.label === 'Other')
  if (activeOther) {
    // Compact-label optimization:
    // when "Other" is active and only one active source deviates from that base,
    // render "base + exception" instead of naming all buckets.
    // Example: × Digital Split (60%, Bandcamp 50%)
    const deviationsFromOther = activeSources.filter(
      source => source.label !== 'Other' && source.percentage !== activeOther.percentage
    )
    if (deviationsFromOther.length === 1) {
      const deviation = deviationsFromOther[0]
      return `× Digital Split (${activeOther.percentage}%, ${deviation.label} ${deviation.percentage}%)`
    }
  }

  const explicitSources = activeSources.map(source => `${source.label} ${source.percentage}%`)
  return `× Digital Split (${explicitSources.join(', ')})`
}

export async function generatePDF(
  artistData: SafeProcessedArtistData,
  labelInfo: LabelInfo,
  periodStart?: string,
  periodEnd?: string,
  invoiceNumber?: string,
  pdfSettings?: Partial<PdfExportSettings>,
  emailOptions?: {
    financeEmail: string
    deadlineDate: string
    donationOrg: string
  },
  artistInfo?: LabelArtist,
  compilationFilters: CompilationFilter[] = []
): Promise<Blob> {
  // Pre-load label logo dimensions so buildPDF can preserve the aspect ratio.
  let logoDimensions: { w: number; h: number } | undefined
  const logoSrc = labelInfo.logoBase64 ?? labelInfo.logo
  if (logoSrc) {
    const naturalDims = await resolveImageDimensions(logoSrc)
    // Only compute fit dimensions when both axes are valid positive values;
    // otherwise leave logoDimensions undefined so buildPDF falls back to the
    // default 25×25 square rather than rendering a potentially distorted image.
    if (naturalDims && naturalDims.width > 0 && naturalDims.height > 0) {
      logoDimensions = computeFitDimensions(naturalDims.width, naturalDims.height, LABEL_LOGO_MAX_WIDTH_MM, LABEL_LOGO_MAX_HEIGHT_MM)
    }
  }

  try {
    const settings = { ...DEFAULT_PDF_SETTINGS, ...pdfSettings }
    return buildPDF(artistData, labelInfo, periodStart, periodEnd, invoiceNumber, settings, emailOptions, artistInfo, logoDimensions, compilationFilters)
  } catch (err) {
    throw new Error(
      `PDF generation failed for "${artistData.artist}": ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

function buildPDF(
  artistData: SafeProcessedArtistData,
  labelInfo: LabelInfo,
  periodStart?: string,
  periodEnd?: string,
  invoiceNumber?: string,
  settings: PdfExportSettings = DEFAULT_PDF_SETTINGS,
  emailOptions?: { financeEmail: string; deadlineDate: string; donationOrg: string },
  artistInfo?: LabelArtist,
  logoDimensions?: { w: number; h: number },
  compilationFilters: CompilationFilter[] = []
): Blob {
  const doc = new jsPDF({ compress: true })
  const margin = 20

  // Embed document metadata so PDF readers show a meaningful title.
  doc.setProperties({ title: `${APP_NAME} · Statement of Sales`, creator: APP_NAME })

  // ── Optional e-mail cover letter page ────────────────────────────────────
  if (settings.includeEmailCoverLetter && labelInfo.emailTemplate) {
    const period = periodStart && periodEnd ? `${periodStart} – ${periodEnd}` : (periodStart ?? periodEnd ?? '')
    const amount = formatCurrency(artistData.finalPayout)
    const appDefaults = {
      financeEmail: emailOptions?.financeEmail,
      invoiceDeadlineDate: emailOptions?.deadlineDate,
      royaltyDonationOrg: emailOptions?.donationOrg,
    }
    const covered = resolveTemplate(
      labelInfo.emailTemplate,
      artistData.artist,
      period,
      amount,
      labelInfo,
      appDefaults
    )
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const coverLines = doc.splitTextToSize(covered, 170)
    const coverPageHeight = doc.internal.pageSize.getHeight()
    let yC = margin
    coverLines.forEach((line: string) => {
      if (yC > coverPageHeight - FOOTER_RESERVED_MM) { doc.addPage(); yC = margin }
      doc.text(line, margin, yC)
      yC += 5
    })
    doc.addPage()
  }

  let yPos = margin

  // Add label logo in the header, filling the right third of the page width.
  // Uses pre-computed dimensions (logoDimensions) to preserve the original
  // aspect ratio — equivalent to CSS object-contain within the right-third area.
  const logoSrc = labelInfo.logoBase64 ?? labelInfo.logo
  if (logoSrc) {
    try {
      const pageWidth = doc.internal.pageSize.getWidth()
      const { w, h } = logoDimensions ?? { w: LABEL_LOGO_MAX_WIDTH_MM, h: LABEL_LOGO_MAX_HEIGHT_MM }
      // Right-align against the right margin so the logo never overflows.
      const logoX = pageWidth - margin - w
      const logoY = yPos - 5
      doc.addImage(logoSrc, 'PNG', logoX, logoY, w, h)
    } catch {
      // Logo rendering failed, continue without it
    }
  }

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  
  if (labelInfo.name) {
    doc.text(labelInfo.name, margin, yPos)
    yPos += 5
  }

  if (labelInfo.legalForm) {
    doc.setTextColor(120, 120, 120)
    doc.text(labelInfo.legalForm, margin, yPos)
    doc.setTextColor(0, 0, 0)
    yPos += 5
  }
  
  if (labelInfo.address) {
    const addressLines = labelInfo.address.split('\n')
    addressLines.forEach((line) => {
      doc.text(line, margin, yPos)
      yPos += 5
    })
  }

  if (labelInfo.email) {
    doc.text(`E-Mail: ${labelInfo.email}`, margin, yPos)
    yPos += 5
  }

  if (labelInfo.taxNumber) {
    doc.text(`Tax Number: ${labelInfo.taxNumber}`, margin, yPos)
    yPos += 5
  }

  if (labelInfo.taxId) {
    doc.text(`VAT ID: ${labelInfo.taxId}`, margin, yPos)
    yPos += 5
  }
  
  yPos += 5

  if (invoiceNumber) {
    doc.setFontSize(10)
    doc.text(`Invoice No.: ${invoiceNumber}`, margin, yPos)
    yPos += 5
  }

  if (periodStart && periodEnd) {
    doc.setFontSize(10)
    doc.text(`Billing Period: ${periodStart} – ${periodEnd}`, margin, yPos)
    yPos += 10
  }

  doc.setLineWidth(0.5)
  doc.line(margin, yPos, 190, yPos)
  yPos += 10

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Statement of Sales', margin, yPos)
  yPos += 10

  doc.setFontSize(12)
  doc.text(`Artist: ${artistData.artist}`, margin, yPos)
  yPos += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  // ── Page footer helper ────────────────────────────────────────────────────
  // Two-row footer layout to prevent element overlap:
  //   Row 1 (footerTopY): label bank / contact info, left-aligned
  //   Row 2 (footerBotY): [NR logo left] [APP_CREDITS center] [Page N/M right]
  // The logo is rendered here (not in a separate post-loop) so draw order is
  // deterministic and text is never painted underneath the logo.
  const drawPageFooter = (data: { pageNumber: number }) => {
    const pageHeight = doc.internal.pageSize.getHeight()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Row 2 baseline — leaves FOOTER_BOTTOM_MARGIN_MM from the bottom edge for readability.
    const footerBotY = pageHeight - FOOTER_BOTTOM_MARGIN_MM
    // Row 1 baseline — FOOTER_ROW_SPACING_MM above Row 2 for label bank/contact text.
    const footerTopY = footerBotY - FOOTER_ROW_SPACING_MM

    // Reset font to a known state so bold/italic set by previous drawing calls (e.g.
    // section headings, autoTable internals) never bleeds into the footer text.
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)

    // ── Row 1: label-specific footer text or bank details ─────────────────
    // Constrained to FOOTER_TEXT_WIDTH_RATIO of the page so it never reaches the
    // center credit text on Row 2.
    const footerLeft = labelInfo.footerText
      ? labelInfo.footerText.replace(/\n/g, ' · ')
      : labelInfo.bankAccount
        ? labelInfo.bankAccount.replace(/\n/g, ' · ')
        : ''
    if (footerLeft) {
      doc.text(footerLeft, margin, footerTopY, { maxWidth: pageWidth * FOOTER_TEXT_WIDTH_RATIO - margin })
    }

    // ── Row 2 left: software branding logo ────────────────────────────────
    try {
      doc.saveGraphicsState()
      doc.setGState(new GState({ opacity: 0.5 }))
      doc.addImage(
        APP_LOGO,
        'PNG',
        margin - FOOTER_LOGO_LEFT_OFFSET_MM,
        footerBotY - APP_LOGO_FOOTER_SIZE_MM + FOOTER_LOGO_VERTICAL_NUDGE_MM,
        APP_LOGO_FOOTER_SIZE_MM,
        APP_LOGO_FOOTER_SIZE_MM
      )
      doc.restoreGraphicsState()
    } catch (err) {
      console.warn('Failed to render app logo in PDF footer:', err)
    }

    // ── Row 2 center: software branding credit ────────────────────────────
    doc.setTextColor(150, 150, 150)
    doc.text(APP_CREDITS, pageWidth / 2, footerBotY, { align: 'center' })

    // ── Row 2 right: page number "Page X of Y" ────────────────────────────
    // `TOTAL_PAGES_PLACEHOLDER` is replaced by the real page count via
    // `doc.putTotalPages()` at the end of `buildPDF`, ensuring every page
    // shows the correct final total rather than the count at render time.
    doc.text(`Page ${data.pageNumber} of ${TOTAL_PAGES_PLACEHOLDER}`, pageWidth - margin, footerBotY, { align: 'right' })

    doc.setTextColor(0, 0, 0)
  }

  // ── Financial waterfall summary ───────────────────────────────────────────
  // Visualises the revenue flow:
  //   Revenue Buckets → × Split% per bucket (omitted when 100%) → Artist Share
  //   → +Manual Revenue → –Expenses → Net Payout
  const physicalReleasesRevenue = artistData.physicalReleasesRevenue

  // Digital revenue broken into streams / downloads / unclassified.
  // Guard against undefined/NaN coming from older cached data by normalising to 0.
  const safeStreamRevenue = isFinite(artistData.totalStreamRevenue) ? artistData.totalStreamRevenue : 0
  const safeDownloadRevenue = isFinite(artistData.totalDownloadRevenue) ? artistData.totalDownloadRevenue : 0
  const safeDigitalRevenue = isFinite(artistData.totalDigitalRevenue) ? artistData.totalDigitalRevenue : 0

  const digitalOtherRevenue = Math.max(0, safeDigitalRevenue - safeStreamRevenue - safeDownloadRevenue)
  const hasStreamDownloadDetail = safeStreamRevenue > 0 || safeDownloadRevenue > 0

  // ── Per-bucket split application ────────────────────────────────────────────
  const digitalAfterFeeDisplay = safeFinite(artistData.digitalRevenueAfterFee)
  const physRelAfterFeeDisplay = artistData.physicalReleasesRevenueAfterFee
  const darkmerchAfterFeeDisplay = artistData.darkmerchRevenueAfterFee
  const digitalSplitPct = artistData.digitalSplitPercentage
  const believeSplitPct = artistData.believeSplitPercentage
  const bandcampSplitPct = artistData.bandcampSplitPercentage
  const physSplitPct = artistData.physicalSplitPercentage
  const darkmerchSplitPct = artistData.darkmerchSplitPercentage

  const waterfallRows: string[][] = []

  const believeAfterFee = safeFinite(artistData.believeDigitalRevenueAfterFee)
  const bandcampAfterFee = safeFinite(artistData.bandcampDigitalRevenueAfterFee)
  const otherDigitalAfterFee = safeFinite(artistData.otherDigitalRevenueAfterFee)

  // ── Bucket share values (after-fee revenue × per-bucket split percentages) ──
  const digitalShare =
    believeAfterFee * (believeSplitPct / 100) +
    bandcampAfterFee * (bandcampSplitPct / 100) +
    otherDigitalAfterFee * (digitalSplitPct / 100)
  const physRelShare = physRelAfterFeeDisplay * (physSplitPct / 100)
  const darkmerchShare = darkmerchAfterFeeDisplay * (darkmerchSplitPct / 100)
  const artistShare = digitalShare + physRelShare + darkmerchShare

  // ── Digital revenue sub-buckets ──────────────────────────────────────────
  if (hasStreamDownloadDetail) {
    if (safeStreamRevenue > 0) {
      waterfallRows.push(['Streaming Revenue', formatCurrency(safeStreamRevenue)])
    }
    if (safeDownloadRevenue > 0) {
      waterfallRows.push(['Download Revenue', formatCurrency(safeDownloadRevenue)])
    }
    if (digitalOtherRevenue > 0) {
      waterfallRows.push(['Digital Revenue (other)', formatCurrency(digitalOtherRevenue)])
    }
  } else if (safeDigitalRevenue > 0) {
    waterfallRows.push(['Digital Revenue', formatCurrency(safeDigitalRevenue)])
  }

  // Show digital split once after all digital sub-buckets (omit when 100% or no after-fee revenue)
  const digitalSources: DigitalSourceSplit[] = [
    { label: 'Believe', percentage: believeSplitPct, hasRevenue: believeAfterFee > 0 },
    { label: 'Bandcamp', percentage: bandcampSplitPct, hasRevenue: bandcampAfterFee > 0 },
    { label: 'Other', percentage: digitalSplitPct, hasRevenue: otherDigitalAfterFee > 0 },
  ]
  const hasReducedDigitalSplit = digitalSources.some(source => source.hasRevenue && source.percentage < 100)
  if (digitalAfterFeeDisplay > 0 && hasReducedDigitalSplit) {
    waterfallRows.push([buildDigitalSplitLabel(digitalSplitPct, digitalSources), formatCurrency(digitalShare)])
  }

  // ── Physical releases ──────────────────────────────────────────────────────
  if (physicalReleasesRevenue > 0) {
    waterfallRows.push(['Physical Releases', formatCurrency(physicalReleasesRevenue)])
    if (physSplitPct < 100) {
      waterfallRows.push([`× Physical Split (${physSplitPct}%)`, formatCurrency(physRelShare)])
    }
  }

  // ── Darkmerch / Merchandise ────────────────────────────────────────────────
  if (artistData.darkmerchRevenue > 0) {
    waterfallRows.push(['Darkmerch / Merchandise', formatCurrency(artistData.darkmerchRevenue)])
    if (darkmerchSplitPct < 100) {
      waterfallRows.push([`× Merchandise Split (${darkmerchSplitPct}%)`, formatCurrency(darkmerchShare)])
    }
  }

  // ── Artist share total (sum of all bucket splits) ──────────────────────────
  waterfallRows.push(['= Artist Share', formatCurrency(artistShare)])

  // ── Post-split: individual manual revenue entries ──────────────────────────
  for (const entry of artistData.manualRevenueEntries) {
    const entryLabel = entry.description ? `+ Manual: ${entry.description}` : '+ Manual Revenue'
    waterfallRows.push([entryLabel, formatCurrency(entry.amount)])
  }

  // ── Post-split: individual deductible expense entries ─────────────────────
  for (const entry of artistData.expenseEntries) {
    const entryLabel = entry.description ? `– ${entry.description}` : '– Deductible Cost / Advance'
    const dateLabel = entry.date ? ` (${entry.date})` : ''
    waterfallRows.push([`${entryLabel}${dateLabel}`, `- ${formatCurrency(entry.amount)}`])
  }

  const isNegativePayout = artistData.finalPayout < 0
  const payoutRowIndex = waterfallRows.length
  const payoutDisplay = isNegativePayout
    ? `- ${formatCurrency(Math.abs(artistData.finalPayout))}`
    : formatCurrency(artistData.finalPayout)
  waterfallRows.push(['= Net Payout (Artist Share)', payoutDisplay])

  autoTable(doc, {
    startY: yPos,
    head: [['Item', 'Amount']],
    body: waterfallRows,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [40, 40, 60], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: margin, right: margin, bottom: FOOTER_RESERVED_MM },
    didParseCell: (data) => {
      if (isNegativePayout && data.section === 'body' && data.row.index === payoutRowIndex) {
        data.cell.styles.textColor = NEGATIVE_PAYOUT_COLOR_RGB
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  // ── Section heading helper ────────────────────────────────────────────────
  // Renders a small bold label above a breakdown table. When insufficient
  // vertical space remains on the current page, a new page is added first so
  // the heading is never orphaned at the bottom of a page without the table
  // that follows it.
  const renderSectionHeading = (title: string): void => {
    const pageHeight = doc.internal.pageSize.getHeight()
    if (yPos >= pageHeight - MIN_SPACE_FOR_SECTION_HEADING_MM) {
      doc.addPage()
      yPos = margin
    }
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 40, 60)
    doc.text(title, margin, yPos)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    yPos += 5
  }

  // ── Release breakdown ─────────────────────────────────────────────────────
  if (settings.includeReleaseBreakdown && artistData.releaseBreakdown.length > 0) {
    const allReleaseBreakdown = settings.hideCompilationsInStatement
      ? artistData.releaseBreakdown.filter(rel => !isCompilationRelease(rel, compilationFilters))
      : artistData.releaseBreakdown
    // Filter out entries that have no usable identifier (empty title AND empty
    // UPC/EAN AND empty catalog number).  These are typically physical merch or
    // platform service-fee rows whose revenue is already counted in the totals.
    const releaseBreakdown = allReleaseBreakdown.filter(
      rel => rel.releaseTitle || rel.upcEan || rel.catalogNumber
    )
    if (releaseBreakdown.length > 0) {
      renderSectionHeading('Revenue by Release')
      autoTable(doc, {
        startY: yPos,
        head: [['Release Title', 'Revenue', 'Qty', 'Type']],
        body: releaseBreakdown.slice(0, MAX_BREAKDOWN_ROWS).map(rel => [
          rel.releaseTitle || '-',
          formatCurrency(rel.revenue),
          String(rel.quantity),
          rel.isPhysical ? 'Physical' : 'Digital',
        ]),
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [40, 40, 60], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 250] },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' },
        },
        margin: { left: margin, right: margin, bottom: FOOTER_RESERVED_MM },
      })
      yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    }
  }

  // ── Platform breakdown ─────────────────────────────────────────────────────
  // Shows Downloads and Streams as separate columns when the data distinguishes
  // them. Falls back to a single Qty column when type info is not available.
  if (settings.includePlatformBreakdown && artistData.platformBreakdown.length > 0) {
    const hasTypeInfo = artistData.platformBreakdown.some(
      p => p.downloadQuantity !== undefined || p.streamQuantity !== undefined
    )
    renderSectionHeading('Revenue by Platform')
    if (hasTypeInfo) {
      autoTable(doc, {
        startY: yPos,
        head: [['Platform', 'Revenue', 'Downloads', 'Streams']],
        body: artistData.platformBreakdown.slice(0, MAX_BREAKDOWN_ROWS).map(p => [
          p.platform || 'Unknown',
          formatCurrency(p.revenue),
          String(p.downloadQuantity ?? 0),
          String(p.streamQuantity ?? 0),
        ]),
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [40, 40, 60], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 250] },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right' },
        },
        margin: { left: margin, right: margin, bottom: FOOTER_RESERVED_MM },
      })
    } else {
      autoTable(doc, {
        startY: yPos,
        head: [['Platform', 'Revenue', 'Qty']],
        body: artistData.platformBreakdown.slice(0, MAX_BREAKDOWN_ROWS).map(p => [
          p.platform || 'Unknown',
          formatCurrency(p.revenue),
          String(p.quantity),
        ]),
        theme: 'striped',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [40, 40, 60], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 250] },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' },
        },
        margin: { left: margin, right: margin, bottom: FOOTER_RESERVED_MM },
      })
    }
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  // ── Country breakdown ─────────────────────────────────────────────────────
  if (settings.includeCountryBreakdown && artistData.countryBreakdown.length > 0) {
    renderSectionHeading('Revenue by Country')
    const topN = settings.topCountriesCount ?? 15
    const shownCountries = artistData.countryBreakdown.slice(0, topN)
    const remainingCountries = artistData.countryBreakdown.length - shownCountries.length
    autoTable(doc, {
      startY: yPos,
      head: [['Country', 'Revenue', 'Qty']],
      body: shownCountries.map(c => [
        c.country,
        formatCurrency(c.revenue),
        String(c.quantity),
      ]),
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [40, 40, 60], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
      },
      margin: { left: margin, right: margin, bottom: FOOTER_RESERVED_MM },
    })
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5
    if (remainingCountries > 0) {
      doc.setFontSize(FOOTNOTE_FONT_SIZE_PT)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(...FOOTNOTE_TEXT_COLOR_RGB)
      doc.text(`(+ ${remainingCountries} more ${remainingCountries === 1 ? 'country' : 'countries'} not shown)`, margin, yPos)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      yPos += 7
    } else {
      yPos += 5
    }
  }

  // ── Monthly breakdown ─────────────────────────────────────────────────────
  if (settings.includeMonthlyBreakdown && artistData.monthlyBreakdown.length > 0) {
    renderSectionHeading('Revenue by Month')
    autoTable(doc, {
      startY: yPos,
      head: [['Month', 'Revenue']],
      body: artistData.monthlyBreakdown.slice(0, MAX_BREAKDOWN_ROWS).map(m => [
        m.month,
        formatCurrency(m.revenue),
      ]),
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [40, 40, 60], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: margin, right: margin, bottom: FOOTER_RESERVED_MM },
    })
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  // ── Pie chart: revenue category breakdown ─────────────────────────────────
  // Drawn using an HTML canvas (available in the browser context) and embedded
  // in the PDF as a PNG image.  Shows each revenue category's share of the
  // total gross revenue so the artist can see the mix at a glance.
  if (settings.includePieChart) {
    /** Canvas pixel dimensions — high enough for crisp rendering on Retina screens. */
    const PIE_CANVAS_SIZE = 600
    /** Vertical centre of the pie as a fraction of canvas height. */
    const PIE_CENTER_Y_RATIO = 0.44
    /** Pie radius as a fraction of canvas size. */
    const PIE_RADIUS_RATIO = 0.36
    /** Gap in px between pie bottom and legend start. */
    const PIE_LEGEND_GAP_PX = 24
    /** Vertical spacing in px between legend rows. */
    const PIE_LEGEND_ROW_HEIGHT_PX = 28

    const physRevenue = artistData.totalPhysicalRevenue - artistData.darkmerchRevenue
    // Digital (other) = all digital revenue not classified as a download or stream
    const digitalOtherRevenue = Math.max(
      0,
      artistData.totalDigitalRevenue - artistData.totalDownloadRevenue - artistData.totalStreamRevenue
    )
    const segments = [
      { label: 'Streams', value: artistData.totalStreamRevenue, color: '#4f86c6' },
      { label: 'Downloads', value: artistData.totalDownloadRevenue, color: '#6bbf87' },
      { label: 'Digital (other)', value: digitalOtherRevenue, color: '#a78bfa' },
      { label: 'Physical Releases', value: physRevenue, color: '#f59e42' },
      { label: 'Merchandise', value: artistData.darkmerchRevenue, color: '#e07070' },
      { label: 'Manual Revenue', value: artistData.manualRevenue, color: '#9ca3af' },
    ].filter(s => s.value > 0)

    const total = segments.reduce((s, seg) => s + seg.value, 0)

    if (segments.length > 0 && total > 0) {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = PIE_CANVAS_SIZE
        canvas.height = PIE_CANVAS_SIZE
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const cx = PIE_CANVAS_SIZE / 2
          const cy = PIE_CANVAS_SIZE * PIE_CENTER_Y_RATIO
          const radius = PIE_CANVAS_SIZE * PIE_RADIUS_RATIO

          let startAngle = -Math.PI / 2
          for (const seg of segments) {
            const slice = (seg.value / total) * 2 * Math.PI
            ctx.beginPath()
            ctx.moveTo(cx, cy)
            ctx.arc(cx, cy, radius, startAngle, startAngle + slice)
            ctx.closePath()
            ctx.fillStyle = seg.color
            ctx.fill()
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = 2
            ctx.stroke()
            startAngle += slice
          }

          // Legend
          const legendStartY = cy + radius + PIE_LEGEND_GAP_PX
          ctx.font = 'bold 20px sans-serif'
          segments.forEach((seg, i) => {
            const lx = 20
            const ly = legendStartY + i * PIE_LEGEND_ROW_HEIGHT_PX
            ctx.fillStyle = seg.color
            ctx.fillRect(lx, ly - 14, 20, 18)
            ctx.fillStyle = '#333333'
            const pct = ((seg.value / total) * 100).toFixed(1)
            ctx.fillText(`${seg.label}: ${pct}%`, lx + 28, ly)
          })

          const imgData = canvas.toDataURL('image/png')
          /** Rendered chart height in PDF mm */
          const chartH = 90
          /** Rendered chart width in PDF mm */
          const chartW = 85
          const pageHeight = doc.internal.pageSize.getHeight()
          if (yPos + chartH > pageHeight - FOOTER_RESERVED_MM) {
            doc.addPage()
            yPos = margin
          }
          renderSectionHeading('Revenue Breakdown')
          const pageWidth = doc.internal.pageSize.getWidth()
          const chartX = (pageWidth - chartW) / 2
          doc.addImage(imgData, 'PNG', chartX, yPos, chartW, chartH)
          yPos += chartH + 8
        }
      } catch (err) {
        // Pie chart rendering failed — log but do not abort PDF generation
        console.warn('Failed to render pie chart in PDF:', err)
      }
    }
  }

  // ── Post-processing: draw footer on every page ────────────────────────────
  // By iterating over all pages here (rather than relying solely on autoTable's
  // `didDrawPage` callback), we guarantee that manually created pages — such as
  // the e-mail cover letter pages produced via `doc.addPage()` — also receive the
  // complete two-row footer with bank info, branding logo, and "Page X of Y".
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    drawPageFooter({ pageNumber: p })
  }

  // Replace all occurrences of the placeholder with the actual final page count.
  // This must be called after every page and table has been generated so jsPDF
  // can substitute the correct total in every footer it drew during the run.
  doc.putTotalPages(TOTAL_PAGES_PLACEHOLDER)

  return doc.output('blob')
}

export function generateExcel(
  artistData: SafeProcessedArtistData,
  labelInfo: LabelInfo,
  periodStart?: string,
  periodEnd?: string,
  compilationFilters: CompilationFilter[] = [],
  settings?: Partial<PdfExportSettings>
): Blob {
  try {
    return buildExcel(artistData, labelInfo, periodStart, periodEnd, compilationFilters, settings)
  } catch (err) {
    throw new Error(
      `Excel generation failed for "${artistData.artist}": ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

function buildExcel(
  artistData: SafeProcessedArtistData,
  labelInfo: LabelInfo,
  periodStart?: string,
  periodEnd?: string,
  compilationFilters: CompilationFilter[] = [],
  settings?: Partial<PdfExportSettings>
): Blob {
  const workbook = XLSX.utils.book_new()
  const digitalFallbackSplit = artistData.digitalSplitPercentage
  // Keep source rows visible when they are economically relevant (have revenue),
  // even if the percentage currently matches the fallback.
  const includeBelieveDigitalSplit =
    artistData.believeSplitPercentage !== digitalFallbackSplit || artistData.believeRevenue > 0
  const includeBandcampDigitalSplit =
    artistData.bandcampSplitPercentage !== digitalFallbackSplit || artistData.bandcampRevenue > 0

  const digitalSplitRows: Array<[string, number]> = []
  if (includeBelieveDigitalSplit) {
    digitalSplitRows.push(['Artist Split – Believe Digital (%)', artistData.believeSplitPercentage])
  }
  if (includeBandcampDigitalSplit) {
    digitalSplitRows.push(['Artist Split – Bandcamp Digital (%)', artistData.bandcampSplitPercentage])
  }
  digitalSplitRows.push(['Artist Split – Other Digital (%)', digitalFallbackSplit])

  const summaryData = [
    ['Statement of Sales'],
    [],
    ['Label', labelInfo.name || ''],
    ['Address', labelInfo.address || ''],
    [],
    ['Artist', artistData.artist],
    ['Period', periodStart && periodEnd ? `${periodStart} - ${periodEnd}` : ''],
    [],
    ['Revenue Summary'],
    ['Believe Revenue', artistData.believeRevenue],
    ['Bandcamp Revenue', artistData.bandcampRevenue],
    ['Darkmerch Revenue', artistData.darkmerchRevenue],
    ['Streaming Revenue', artistData.totalStreamRevenue],
    ['Download Revenue', artistData.totalDownloadRevenue],
    ['Digital Revenue (Total)', artistData.totalDigitalRevenue],
    ['Physical Revenue', artistData.totalPhysicalRevenue],
    ['Manual Revenue', artistData.manualRevenue],
    ['Gross Revenue', artistData.grossRevenue],
    ...digitalSplitRows,
    ['Artist Split – Physical Releases (%)', artistData.physicalSplitPercentage],
    ['Artist Split – Merchandise/Darkmerch (%)', artistData.darkmerchSplitPercentage],
    ['Final Payout', artistData.finalPayout],
  ]

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 25 }]

  if (summarySheet['A1']) {
    summarySheet['A1'].s = { font: { bold: true, sz: 14 } }
  }

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

  // Release breakdown sheet (aggregated, memory-efficient alternative to raw rows)
  const shouldHideCompilations = settings?.hideCompilationsInStatement ?? DEFAULT_PDF_SETTINGS.hideCompilationsInStatement
  const releaseBreakdown = shouldHideCompilations
    ? artistData.releaseBreakdown.filter(rel => !isCompilationRelease(rel, compilationFilters))
    : artistData.releaseBreakdown
  if (releaseBreakdown.length > 0) {
    const releaseHeaders = [
      'Release Title', 'UPC/EAN', 'Catalog Number', 'Revenue', 'Quantity', 'Type',
    ]
    const releaseRows = releaseBreakdown.map(r => [
      r.releaseTitle || '',
      r.upcEan || '',
      r.catalogNumber || '',
      r.revenue,
      r.quantity,
      r.isPhysical ? 'Physical' : 'Digital',
    ])
    const releaseSheet = XLSX.utils.aoa_to_sheet([releaseHeaders, ...releaseRows])
    releaseSheet['!cols'] = [
      { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 },
    ]
    XLSX.utils.book_append_sheet(workbook, releaseSheet, 'Releases')
  }

  // Platform breakdown sheet
  if (artistData.platformBreakdown.length > 0) {
    const platformHeaders = ['Platform', 'Revenue', 'Quantity']
    const platformRows = artistData.platformBreakdown.map(p => [
      p.platform || 'Unknown', p.revenue, p.quantity,
    ])
    const platformSheet = XLSX.utils.aoa_to_sheet([platformHeaders, ...platformRows])
    platformSheet['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(workbook, platformSheet, 'Platforms')
  }

  // Country breakdown sheet
  if (artistData.countryBreakdown.length > 0) {
    const countryHeaders = ['Country', 'Revenue', 'Quantity']
    const countryRows = artistData.countryBreakdown.map(c => [
      c.country || 'Unknown', c.revenue, c.quantity,
    ])
    const countrySheet = XLSX.utils.aoa_to_sheet([countryHeaders, ...countryRows])
    countrySheet['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(workbook, countrySheet, 'Countries')
  }

  // Monthly breakdown sheet
  if (artistData.monthlyBreakdown.length > 0) {
    const monthHeaders = ['Month', 'Revenue']
    const monthRows = artistData.monthlyBreakdown.map(m => [m.month, m.revenue])
    const monthSheet = XLSX.utils.aoa_to_sheet([monthHeaders, ...monthRows])
    monthSheet['!cols'] = [{ wch: 12 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(workbook, monthSheet, 'Monthly')
  }

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** Downloads a Blob as a file. Revokes the object URL after a short delay so
 *  the browser has time to initiate the download before the reference is freed. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

/**
 * Generates a ZIP of PDF and/or Excel statements for all artists.
 *
 * Artists are processed sequentially (one per event-loop turn via
 * `setTimeout(0)` yields) so that:
 *  1. The browser UI remains fully responsive during a large export.
 *  2. Memory consumption stays bounded — only one artist's document is live
 *     at a time before it is handed off to JSZip.
 *
 * @param onProgress  Optional callback fired after each artist is processed.
 *                    Receives (done, total) so callers can show a progress bar.
 */
export async function generateZipOfAllStatements(
  artistsData: SafeProcessedArtistData[],
  labelInfo: LabelInfo,
  periodStart?: string,
  periodEnd?: string,
  format: 'pdf' | 'excel' | 'both' = 'both',
  onProgress?: (done: number, total: number) => void,
  pdfSettings?: Partial<PdfExportSettings>,
  emailOptions?: { financeEmail: string; deadlineDate: string; donationOrg: string },
  labelArtists?: LabelArtist[],
  appDefaults?: Partial<AppDefaults>,
  emailConfig?: Partial<EmailConfig>,
  compilationFilters: CompilationFilter[] = []
): Promise<Blob> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const total = artistsData.length
  const currentYear = new Date().getFullYear()

  // Build a O(1) lookup map by lowercase artist name to avoid O(n²) in the loop.
  const artistInfoMap = new Map<string, LabelArtist>()
  for (const la of labelArtists ?? []) {
    artistInfoMap.set(la.name.toLowerCase(), la)
  }

  for (let i = 0; i < artistsData.length; i++) {
    const artistData = artistsData[i]

    // Yield to the event loop so the main thread can paint progress updates
    // and remain interactive between each document generation.
    await new Promise<void>(resolve => setTimeout(resolve, 0))

    const safeArtistName = artistData.artist.replace(/[^a-z0-9]/gi, '_')

    // Sequential invoice number: PREFIX-YEAR-NNNN
    const prefix = labelInfo.invoiceNumberPrefix ?? 'SOS'
    const invoiceNumber = `${prefix}-${currentYear}-${String(i + 1).padStart(4, '0')}`

    const artistInfo = artistInfoMap.get(artistData.artist.toLowerCase())

    let pdfBlob: Blob | undefined
    if (format === 'pdf' || format === 'both') {
      pdfBlob = await generatePDF(artistData, labelInfo, periodStart, periodEnd, invoiceNumber, pdfSettings, emailOptions, artistInfo, compilationFilters)
      zip.file(`${safeArtistName}_statement.pdf`, pdfBlob)
    }

    if (format === 'excel' || format === 'both') {
      const excelBlob = generateExcel(artistData, labelInfo, periodStart, periodEnd, compilationFilters, pdfSettings)
      zip.file(`${safeArtistName}_statement.xlsx`, excelBlob)
    }

    if (artistInfo?.email && labelInfo.emailTemplate && pdfBlob && appDefaults && emailConfig) {
      const { resolveTemplate } = await import('./utils')
      const period = periodStart && periodEnd ? `${periodStart} – ${periodEnd}` : (periodStart ?? periodEnd ?? '')
      const amount = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(artistData.finalPayout)

      const subject = resolveTemplate(
        emailConfig.subjectTemplate ?? 'Statement of Sales – {period}',
        artistData.artist,
        period,
        amount,
        labelInfo,
        appDefaults
      )
      const body = resolveTemplate(labelInfo.emailTemplate, artistData.artist, period, amount, labelInfo, appDefaults)

      const fromName = emailConfig.fromName || labelInfo.name || 'Label'
      const fromEmail = emailConfig.fromEmail || labelInfo.email || 'noreply@label.com'
      const toEmail = artistInfo.email

      // Convert PDF Blob to Base64 for EML attachment using FileReader
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          resolve(result.split(',')[1]) // extract base64 data after "data:application/pdf;base64,"
        }
        reader.onerror = reject
        reader.readAsDataURL(pdfBlob as Blob)
      })

      // EML standard format with boundary
      const boundary = `----=_NextPart_${Date.now()}_${Math.random().toString(36).substring(2)}`

      const emlContent = [
        `From: "${fromName}" <${fromEmail}>`,
        `To: "${artistData.artist}" <${toEmail}>`,
        emailConfig.replyTo ? `Reply-To: ${emailConfig.replyTo}` : '',
        `Subject: ${subject}`,
        `Date: ${new Date().toUTCString()}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        ``,
        `This is a multi-part message in MIME format.`,
        `--${boundary}`,
        `Content-Type: text/plain; charset=UTF-8`,
        `Content-Transfer-Encoding: 8bit`,
        ``,
        body,
        ``,
        `--${boundary}`,
        `Content-Type: application/pdf; name="${safeArtistName}_statement.pdf"`,
        `Content-Disposition: attachment; filename="${safeArtistName}_statement.pdf"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        pdfBase64.match(/.{1,76}/g)?.join('\n') || pdfBase64,
        ``,
        `--${boundary}--`
      ].filter(l => l !== undefined).join('\r\n')

      zip.file(`${safeArtistName}_email.eml`, new Blob([emlContent], { type: 'message/rfc822' }))
    }

    onProgress?.(i + 1, total)
  }

  return await zip.generateAsync({ type: 'blob' })
}
