import type {
  CompilationFilter,
  LabelInfo,
  PdfExportSettings,
  SafeProcessedArtistData,
} from '../types'
import { DEFAULT_PDF_SETTINGS, isCompilationRelease } from './shared'

/**
 * Generates an Excel statement workbook for one artist.
 */
export async function generateExcel(
  artistData: SafeProcessedArtistData,
  labelInfo: LabelInfo,
  periodStart?: string,
  periodEnd?: string,
  compilationFilters: CompilationFilter[] = [],
  settings?: Partial<PdfExportSettings>,
): Promise<Blob> {
  try {
    return await buildExcel(artistData, labelInfo, periodStart, periodEnd, compilationFilters, settings)
  } catch (err) {
    throw new Error(
      `Excel generation failed for "${artistData.artist}": ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

async function buildExcel(
  artistData: SafeProcessedArtistData,
  labelInfo: LabelInfo,
  periodStart?: string,
  periodEnd?: string,
  compilationFilters: CompilationFilter[] = [],
  settings?: Partial<PdfExportSettings>,
): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const digitalFallbackSplit = artistData.digitalSplitPercentage
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

  const summaryData: Array<Array<string | number>> = [
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

  const summarySheet = workbook.addWorksheet('Summary')
  summarySheet.columns = [{ width: 38 }, { width: 25 }]
  summarySheet.addRows(summaryData)
  summarySheet.getCell('A1').font = { bold: true, size: 14 }

  const shouldHideCompilations = settings?.hideCompilationsInStatement ?? DEFAULT_PDF_SETTINGS.hideCompilationsInStatement
  const releaseBreakdown = shouldHideCompilations
    ? artistData.releaseBreakdown.filter(rel => !isCompilationRelease(rel, compilationFilters))
    : artistData.releaseBreakdown
  if (releaseBreakdown.length > 0) {
    const releaseSheet = workbook.addWorksheet('Releases')
    releaseSheet.columns = [
      { width: 35 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 10 }, { width: 10 },
    ]
    releaseSheet.addRow(['Release Title', 'UPC/EAN', 'Catalog Number', 'Revenue', 'Quantity', 'Type'])
    for (const r of releaseBreakdown) {
      releaseSheet.addRow([
        r.releaseTitle || '',
        r.upcEan || '',
        r.catalogNumber || '',
        r.revenue,
        r.quantity,
        r.isPhysical ? 'Physical' : 'Digital',
      ])
    }
  }

  if (artistData.platformBreakdown.length > 0) {
    const platformSheet = workbook.addWorksheet('Platforms')
    platformSheet.columns = [{ width: 25 }, { width: 15 }, { width: 10 }]
    platformSheet.addRow(['Platform', 'Revenue', 'Quantity'])
    for (const p of artistData.platformBreakdown) {
      platformSheet.addRow([p.platform || 'Unknown', p.revenue, p.quantity])
    }
  }

  if (artistData.countryBreakdown.length > 0) {
    const countrySheet = workbook.addWorksheet('Countries')
    countrySheet.columns = [{ width: 20 }, { width: 15 }, { width: 10 }]
    countrySheet.addRow(['Country', 'Revenue', 'Quantity'])
    for (const c of artistData.countryBreakdown) {
      countrySheet.addRow([c.country || 'Unknown', c.revenue, c.quantity])
    }
  }

  if (artistData.monthlyBreakdown.length > 0) {
    const monthSheet = workbook.addWorksheet('Monthly')
    monthSheet.columns = [{ width: 12 }, { width: 15 }]
    monthSheet.addRow(['Month', 'Revenue'])
    for (const m of artistData.monthlyBreakdown) {
      monthSheet.addRow([m.month, m.revenue])
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}