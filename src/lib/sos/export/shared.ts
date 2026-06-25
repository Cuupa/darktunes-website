import type { CompilationFilter, PdfExportSettings, SafeProcessedArtistData } from '../types'

/** Default PDF/Excel export settings — all major sections enabled, cover letter off. */
export const DEFAULT_PDF_SETTINGS: PdfExportSettings = {
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

export function safeFinite(value: number): number {
  return isFinite(value) ? value : 0
}

/**
 * Returns true when a release row matches any active compilation filter.
 */
export function isCompilationRelease(
  release: Pick<SafeProcessedArtistData['releaseBreakdown'][number], 'releaseTitle' | 'upcEan' | 'catalogNumber'>,
  compilationFilters: CompilationFilter[],
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

export async function resolveImageDimensions(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export function computeFitDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number,
): { w: number; h: number } {
  const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight)
  return { w: naturalWidth * scale, h: naturalHeight * scale }
}

export const LABEL_LOGO_MAX_WIDTH_MM = 50
export const LABEL_LOGO_MAX_HEIGHT_MM = 30
export const APP_LOGO_FOOTER_SIZE_MM = 6
export const FOOTER_LOGO_LEFT_OFFSET_MM = 4
export const FOOTER_LOGO_VERTICAL_NUDGE_MM = 1
export const FOOTER_BOTTOM_MARGIN_MM = 6
export const FOOTER_ROW_SPACING_MM = 6
export const FOOTER_TEXT_WIDTH_RATIO = 0.6
export const FOOTER_RESERVED_MM = FOOTER_BOTTOM_MARGIN_MM + FOOTER_ROW_SPACING_MM + 6
export const MAX_BREAKDOWN_ROWS = 500
export const MIN_SPACE_FOR_SECTION_HEADING_MM = 60
export const FOOTNOTE_FONT_SIZE_PT = 7
export const FOOTNOTE_TEXT_COLOR_RGB: [number, number, number] = [120, 120, 140]
export const NEGATIVE_PAYOUT_COLOR_RGB: [number, number, number] = [200, 0, 0]
export const TOTAL_PAGES_PLACEHOLDER = '{total_pages}'

export type DigitalSourceSplit = {
  label: 'Believe' | 'Bandcamp' | 'Other'
  percentage: number
  hasRevenue: boolean
}

export function buildDigitalSplitLabel(
  digitalFallbackPercentage: number,
  sources: DigitalSourceSplit[],
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
    const deviationsFromOther = activeSources.filter(
      source => source.label !== 'Other' && source.percentage !== activeOther.percentage,
    )
    if (deviationsFromOther.length === 1) {
      const deviation = deviationsFromOther[0]
      return `× Digital Split (${activeOther.percentage}%, ${deviation.label} ${deviation.percentage}%)`
    }
  }

  const explicitSources = activeSources.map(source => `${source.label} ${source.percentage}%`)
  return `× Digital Split (${explicitSources.join(', ')})`
}