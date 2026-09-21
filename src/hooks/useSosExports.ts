'use client'

import { useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { useMergedAccountingLabels } from '@/lib/i18n/accountingFallbacks'
import { interpolate } from '@/lib/i18n/interpolate'
import { explainSosError } from '@/lib/sos/explainSosError'
import {
  generatePDF,
  generateExcel,
  downloadBlob,
  generateZipOfAllStatements,
} from '@/lib/sos/export-utils'
import { createSafeFilename } from '@/lib/sos/utils'
import { isValidArtistId } from '@/lib/sos/validation'
import { isValidPeriodRange } from '@/lib/sos/accountingInputValidation'
import { ExcelExportWorkerError } from '@/lib/sos/excelExportError'
import {
  DEFAULT_EXCEL_EXPORT_SETTINGS,
  normalizeExcelExportSettings,
  type ExcelExportSettingsPatch,
} from '@/lib/sos/excelExportSettings'
import type { SosExcelBuildArgs } from '@/workers/sos-csv-processor.worker'
import { uploadStatement } from '../../app/portal/statements/_actions/uploadStatement'
import {
  buildLineItemsFromArtistData,
  computeTotalStreamsFromArtistData,
  monthToPeriodDate,
} from '@/lib/sos/lineItemsFromArtistData'
import { persistAnalyticsAfterStatementUpload } from '@/lib/sos/persistAfterStatementUpload'
import type { TerritoryMetricRow } from '@/lib/sos/data-processor'
import type { MerchOrderRow } from '@/lib/sos/merchOrderRows'
import type {
  SafeProcessedArtistData,
  LabelInfo,
  PdfExportSettings,
  AppDefaults,
  LabelArtist,
  EmailConfig,
  CompilationFilter,
  ArtistRevenue,
} from '@/lib/sos/types'

export interface SosExportPersistContext {
  territoryMetrics: TerritoryMetricRow[]
  merchOrderRows: MerchOrderRow[]
  revenues: ArtistRevenue[]
  bronzeBatchIds: string[]
  sourceFileCount?: number
  archivedFileCount?: number
  unarchivedSourceFiles?: string[]
  /** Fingerprint of the rules stand used for this calculation (#620). */
  rulesFingerprint?: string
  /** Spot + historical FX rates used for this calculation (#620). */
  fxSnapshot?: Record<string, unknown>
}

/** Compact, JSON-safe calculation stand stored with a released statement (#620). */
function buildCalculationSnapshot(
  artistData: SafeProcessedArtistData,
  totalStreams: number,
): Record<string, unknown> {
  return {
    finalPayout: artistData.finalPayout,
    openingBalanceEur: artistData.openingBalanceEur,
    amountDueEur: artistData.amountDueEur,
    grossRevenue: artistData.grossRevenue,
    splitPercentage: artistData.splitPercentage,
    manualRevenue: artistData.manualRevenue,
    totalExpenses: artistData.totalExpenses,
    distributionFeeDeducted: artistData.distributionFeeDeducted,
    totalStreams,
  }
}

/** Converts a Blob to a Base64-encoded string. */
async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
}

function wantsRawExcelSheet(settings?: ExcelExportSettingsPatch): boolean {
  if (!settings || (!('sheets' in settings) && !('columns' in settings))) {
    return DEFAULT_EXCEL_EXPORT_SETTINGS.sheets.raw
  }
  return normalizeExcelExportSettings(settings).sheets.raw
}

function resolveBronzeBatchLineage(bronzeBatchIds: string[] | undefined) {
  const batchIds = bronzeBatchIds ?? []
  return {
    batchIds,
    /** Statement row stores a single primary batch; full lineage lives on period summaries. */
    primaryBatchId: batchIds[0],
  }
}

const exportFallback = {
  exportNoArtistData: 'No data found for artist "{artist}"',
  exportPdfDownloaded: 'PDF for "{artist}" downloaded',
  exportPdfFailed: 'The PDF was not created, so nothing was downloaded.',
  exportExcelDownloaded: 'Excel for "{artist}" downloaded',
  exportExcelFailed: 'The Excel file was not created, so nothing was downloaded.',
  exportExcelPreparing: 'Preparing Excel for "{artist}"…',
  exportExcelRawSkipped:
    'Original-report files were skipped. Summary sheets are in the file.',
  exportExcelRawRequired:
    'Original distributor tabs could not be attached. The file was not downloaded so an incomplete statement cannot be sent by mistake. Retry, or turn off Raw data for a summary-only file.',
  exportExcelProgressReports: 'Collecting original reports…',
  exportExcelProgressSummary: 'Writing summary workbook…',
  exportExcelTimeout:
    'Excel export stopped after 5 minutes. The file is too large — turn off Raw data or export fewer artists.',
  exportExcelCancelled: 'The Excel export was cancelled. Nothing was downloaded.',
  exportExcelStale:
    'The sales files or rules changed after this export started. The file was not downloaded. Export again.',
  exportExcelBusy: 'An Excel export is already running. Wait until it finishes, then retry.',
  exportExcelRawLimit:
    'Too many raw rows ({rows}). The limit is {limit} — turn off Raw data for a summary-only file.',
  exportExcelBatchSkipped:
    '{count} artist(s) had no original-report Excel and were skipped in the ZIP. The ZIP contains a placeholder note for each.',
  exportZipDownloaded: 'ZIP with {count} statements downloaded',
  exportZipFailed: 'The ZIP was not created, so nothing was downloaded.',
  exportPortalDraftSaved:
    'Draft statement saved to portal. Approve in Settlement Center to notify the artist.',
  exportPortalUploadFailed: '{error} A local PDF was saved instead so the numbers are not lost.',
  exportNoSelectedArtists:
    'No processed amounts match the selected artists. Process the CSVs first, then select artists that appear on Amounts.',
  exportNoneSelected: 'No artists were selected for export. Select at least one row on Amounts.',
  exportPublishFailed: 'The statement draft was not created.',
  exportPortalUploading: 'Uploading statement to portal…',
  exportPeriodRequired:
    'Set a valid billing period (YYYY-MM) before exporting or publishing. Nothing was changed.',
  exportArchiveRequired:
    'Archive every uploaded source file before creating a statement. Preview and Excel still work.',
} as const

function buildUploadPayload(
  artistData: SafeProcessedArtistData,
  periodStart: string,
  periodEnd: string,
) {
  const lineItems = buildLineItemsFromArtistData('pending', artistData).map(
    ({ statementId: _statementId, releaseId, platform, country, streams, revenueEur, quantity }) => ({
      releaseId: releaseId ?? undefined,
      platform: platform ?? undefined,
      country: country ?? undefined,
      streams,
      revenueEur,
      quantity,
    }),
  )
  return {
    periodStart: monthToPeriodDate(periodStart, false),
    periodEnd: monthToPeriodDate(periodEnd || periodStart, true),
    totalStreams: computeTotalStreamsFromArtistData(artistData),
    lineItems,
  }
}

/**
 * Provides PDF, Excel and ZIP export actions with error handling.
 * Uses the safe (no raw-transaction) artist data from the Web Worker.
 */
export function useExports(
  processedData: SafeProcessedArtistData[],
  labelInfo: LabelInfo,
  periodStart: string,
  periodEnd: string,
  pdfSettings?: Partial<PdfExportSettings>,
  appDefaults?: Partial<AppDefaults>,
  labelArtists?: LabelArtist[],
  emailConfig?: Partial<EmailConfig>,
  compilationFilters: CompilationFilter[] = [],
  autoUploadToPortal = false,
  persistContext?: SosExportPersistContext,
  requestExcelBlob?: (
    args: SosExcelBuildArgs,
    onProgress?: (phase: string, rows?: number) => void,
  ) => Promise<Blob | null>,
) {
  const t = useMergedAccountingLabels(exportFallback)
  const zipAbortRef = useRef<AbortController | null>(null)

  const startZipExport = useCallback(() => {
    zipAbortRef.current?.abort()
    const controller = new AbortController()
    zipAbortRef.current = controller
    return controller.signal
  }, [])

  /**
   * The binding accounting period is required for every export and portal
   * write. An invalid period blocks the action with a visible reason — there
   * is no replacement quarter/year fallback.
   */
  const requirePeriod = useCallback((): boolean => {
    if (!isValidPeriodRange(periodStart, periodEnd)) {
      toast.error(t.exportPeriodRequired)
      return false
    }
    return true
  }, [periodStart, periodEnd, t.exportPeriodRequired])

  const requireArchive = useCallback((): boolean => {
    const sourceFileCount = persistContext?.sourceFileCount ?? 0
    const archivedFileCount = persistContext?.archivedFileCount ?? persistContext?.bronzeBatchIds.length ?? 0
    if (sourceFileCount > 0 && archivedFileCount < sourceFileCount) {
      toast.error(t.exportArchiveRequired)
      return false
    }
    return true
  }, [persistContext, t.exportArchiveRequired])

  /** Maps typed Excel worker failures to a specific toast message. */
  const excelWorkerErrorMessage = useCallback(
    (err: unknown): string | null => {
      if (!(err instanceof ExcelExportWorkerError)) return null
      if (err.code === 'EXCEL_TIMEOUT') return t.exportExcelTimeout
      if (err.code === 'EXCEL_CANCELLED') return t.exportExcelCancelled
      if (err.code === 'EXCEL_STALE_REVISION') return t.exportExcelStale
      if (err.code === 'EXCEL_BUSY') return t.exportExcelBusy
      if (err.code === 'EXCEL_RAW_ROWS_LIMIT') {
        return interpolate(t.exportExcelRawLimit, {
          rows: err.rows?.toLocaleString('en-US') ?? '?',
          limit: err.limit?.toLocaleString('en-US') ?? '?',
        })
      }
      return null
    },
    [t],
  )

  const emailOptions = useMemo(
    () =>
      appDefaults
        ? {
            financeEmail: appDefaults.financeEmail ?? '',
            deadlineDate: appDefaults.invoiceDeadlineDate ?? '',
            donationOrg: appDefaults.royaltyDonationOrg ?? '',
          }
        : undefined,
    [appDefaults]
  )

  // Pre-build a O(1) lowercase name → LabelArtist lookup map.
  const artistInfoMap = useMemo(() => {
    const map = new Map<string, LabelArtist>()
    for (const la of labelArtists ?? []) {
      map.set(la.name.toLowerCase(), la)
    }
    return map
  }, [labelArtists])

  const handleDownloadPDF = useCallback(
    async (artist: string) => {
      const artistData = processedData.find(d => d.artist === artist)
      if (!artistData) {
        toast.error(interpolate(t.exportNoArtistData, { artist }))
        return
      }
      if (!requirePeriod()) return

      const currentYear = new Date().getFullYear()
      const prefix = labelInfo.invoiceNumberPrefix ?? 'SOS'
      const artistSlug = artist.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4) || '0001'
      const invoiceNumber = `${prefix}-${currentYear}-${artistSlug}`

      const artistInfo = artistInfoMap.get(artist.toLowerCase())

      try {
        const blob = await generatePDF(
          artistData,
          labelInfo,
          periodStart || undefined,
          periodEnd || undefined,
          invoiceNumber,
          pdfSettings,
          emailOptions,
          artistInfo,
          compilationFilters
        )

        // Attempt direct Server Action upload if auto-upload is enabled and artist is linked
        const shouldUpload =
          autoUploadToPortal &&
          artistInfo?.artistId != null &&
          isValidArtistId(artistInfo.artistId)

        if (shouldUpload && artistInfo?.artistId) {
          if (!requireArchive()) {
            downloadBlob(blob, `${createSafeFilename(artist)}_statement.pdf`)
            return
          }
          const filename = `${createSafeFilename(artist)}_statement.pdf`

          toast.loading(t.exportPortalUploading, { id: 'sos-upload' })

          const pdfBase64 = await blobToBase64(blob)
          const analyticsPayload = buildUploadPayload(artistData, periodStart, periodEnd)
          const { batchIds, primaryBatchId } = resolveBronzeBatchLineage(
            persistContext?.bronzeBatchIds,
          )
          const result = await uploadStatement({
            artistId: artistInfo.artistId,
            filename,
            period: periodStart,
            amountEur: artistData.finalPayout,
            ...analyticsPayload,
            batchId: primaryBatchId,
            pdfBase64,
            rulesFingerprint: persistContext?.rulesFingerprint,
            fxSnapshot: persistContext?.fxSnapshot,
            calculationSnapshot: buildCalculationSnapshot(
              artistData,
              analyticsPayload.totalStreams,
            ),
            sourceFileCount: persistContext?.sourceFileCount,
            archivedFileCount: persistContext?.archivedFileCount,
          })

          if (result.success) {
            if (
              persistContext &&
              periodStart &&
              (persistContext.territoryMetrics.length > 0 ||
                persistContext.merchOrderRows.length > 0)
            ) {
              void persistAnalyticsAfterStatementUpload({
                artistName: artist,
                periodStart,
                periodEnd: periodEnd || periodStart,
                territoryMetrics: persistContext.territoryMetrics,
                merchOrderRows: persistContext.merchOrderRows,
                labelArtists: labelArtists ?? [],
                revenues: persistContext.revenues,
                bronzeBatchIds: batchIds,
                batchId: primaryBatchId,
              })
            }
            toast.success(t.exportPortalDraftSaved, {
              id: 'sos-upload',
            })
          } else {
            toast.error(
              interpolate(t.exportPortalUploadFailed, {
                error: explainSosError(result.error, t),
              }),
              { id: 'sos-upload' },
            )
            downloadBlob(blob, `${createSafeFilename(artist)}_statement.pdf`)
          }
        } else {
          downloadBlob(blob, `${createSafeFilename(artist)}_statement.pdf`)
          toast.success(interpolate(t.exportPdfDownloaded, { artist }))
        }
      } catch (err) {
        toast.error(t.exportPdfFailed, { description: explainSosError(err, t) })
        console.error('PDF export error:', err)
      }
    },
    [processedData, labelInfo, periodStart, periodEnd, pdfSettings, emailOptions, artistInfoMap, compilationFilters, autoUploadToPortal, persistContext, labelArtists, t, requirePeriod, requireArchive]
  )

  const handleDownloadExcel = useCallback(
    async (artist: string, excelSettings?: ExcelExportSettingsPatch) => {
      const artistData = processedData.find(d => d.artist === artist)
      if (!artistData) {
        toast.error(interpolate(t.exportNoArtistData, { artist }))
        return
      }
      if (!requirePeriod()) return

      const toastId = toast.loading(interpolate(t.exportExcelPreparing, { artist }))
      try {
        const wantRaw = wantsRawExcelSheet(excelSettings)
        let blob: Blob | null = null
        if (wantRaw && requestExcelBlob) {
          blob = await requestExcelBlob(
            {
              artist,
              artistData,
              labelInfo,
              periodStart: periodStart || undefined,
              periodEnd: periodEnd || undefined,
              compilationFilters,
              settings: excelSettings ?? pdfSettings,
            },
            (phase, rows) => {
              const description =
                phase === 'original-reports'
                  ? rows
                    ? `${t.exportExcelProgressReports} ${rows}`
                    : t.exportExcelProgressReports
                  : phase === 'summary'
                    ? t.exportExcelProgressSummary
                    : undefined
              toast.loading(interpolate(t.exportExcelPreparing, { artist }), {
                id: toastId,
                description,
              })
            },
          )
          if (!blob) {
            toast.error(t.exportExcelRawRequired, { id: toastId })
            return
          }
        } else if (wantRaw) {
          toast.error(t.exportExcelRawRequired, { id: toastId })
          return
        }
        if (!blob) {
          blob = await generateExcel(
            artistData,
            labelInfo,
            periodStart || undefined,
            periodEnd || undefined,
            compilationFilters,
            excelSettings ?? pdfSettings,
            [],
          )
        }
        const filename = wantRaw
          ? `${createSafeFilename(artist)}_statement.xlsx`
          : `${createSafeFilename(artist)}_statement_summary-only.xlsx`
        downloadBlob(blob, filename)
        toast.success(interpolate(t.exportExcelDownloaded, { artist }), { id: toastId })
      } catch (err) {
        const workerMessage = excelWorkerErrorMessage(err)
        if (workerMessage) {
          toast.error(workerMessage, { id: toastId })
          return
        }
        toast.error(t.exportExcelFailed, { id: toastId, description: explainSosError(err, t) })
        console.error('Excel export error:', err)
      }
    },
    [processedData, labelInfo, periodStart, periodEnd, compilationFilters, pdfSettings, requestExcelBlob, t, excelWorkerErrorMessage, requirePeriod]
  )

  /**
   * Queued batch export — generates one document at a time so the browser
   * never tries to build hundreds of PDFs simultaneously. Progress is shown
   * via an updating sonner toast so the user sees exactly how far along the
   * export is without the tab freezing.
   */
  const handleDownloadAll = useCallback(async (excelSettings?: ExcelExportSettingsPatch) => {
    if (processedData.length === 0) {
      toast.info('No revenue data to export')
      return
    }
    if (!requirePeriod()) return

    const total = processedData.length
    const toastId = toast.loading(`Preparing 1 / ${total} statements…`)
    let current = 0
    const skippedExcel: string[] = []
    try {
      const blob = await generateZipOfAllStatements(
        processedData,
        labelInfo,
        periodStart || undefined,
        periodEnd || undefined,
        'both',
        (done, tot) => {
          current = done
          if (done < tot) {
            toast.loading(`Generating ${done + 1} / ${tot} statements…`, { id: toastId })
          }
        },
        pdfSettings,
        emailOptions,
        labelArtists,
        appDefaults,
        emailConfig,
        compilationFilters,
        excelSettings,
        wantsRawExcelSheet(excelSettings)
          ? (name, data, onProgress) =>
              requestExcelBlob?.({
                artist: name,
                artistData: data,
                labelInfo,
                periodStart: periodStart || undefined,
                periodEnd: periodEnd || undefined,
                compilationFilters,
                settings: excelSettings ?? pdfSettings,
              }, onProgress) ?? Promise.resolve(null)
          : undefined,
        (artist, phase, rows) => {
          const description =
            phase === 'summary'
              ? t.exportExcelProgressSummary
              : `${t.exportExcelProgressReports}${rows ? ` ${rows}` : ''}`
          toast.loading(`Generating ${Math.max(1, current)} / ${total} statements…`, {
            id: toastId,
            description: `${artist}: ${description}`,
          })
        },
        (artist) => skippedExcel.push(artist),
        startZipExport(),
      )
      downloadBlob(blob, 'artist_statements.zip')
      toast.success(`All ${total} statements downloaded`, { id: toastId })
      if (skippedExcel.length > 0) {
        toast.warning(interpolate(t.exportExcelBatchSkipped, { count: skippedExcel.length }))
      }
    } catch (err) {
      const workerMessage = excelWorkerErrorMessage(err)
      if (workerMessage) {
        toast.error(workerMessage, { id: toastId })
        return
      }
      toast.error(t.exportZipFailed, { id: toastId, description: explainSosError(err, t) })
      console.error('ZIP export error:', err)
    }
  }, [processedData, labelInfo, periodStart, periodEnd, pdfSettings, emailOptions, labelArtists, appDefaults, emailConfig, compilationFilters, requestExcelBlob, t, excelWorkerErrorMessage, requirePeriod, startZipExport])

  /**
   * Queued batch export for a specific subset of artists — same async queue
   * as handleDownloadAll but filters processedData to only the provided names.
   */
  const handleDownloadSelected = useCallback(async (
    selectedArtistNames: string[],
    excelSettings?: ExcelExportSettingsPatch,
  ) => {
    if (selectedArtistNames.length === 0) {
      toast.info(t.exportNoneSelected)
      return
    }
    if (!requirePeriod()) return

    const subset = processedData.filter(d => selectedArtistNames.includes(d.artist))
    if (subset.length === 0) {
      toast.error(t.exportNoSelectedArtists)
      return
    }

    const total = subset.length
    const toastId = toast.loading(`Preparing 1 / ${total} statements…`)
    let current = 0
    const skippedExcel: string[] = []
    try {
      const blob = await generateZipOfAllStatements(
        subset,
        labelInfo,
        periodStart || undefined,
        periodEnd || undefined,
        'both',
        (done, tot) => {
          current = done
          if (done < tot) {
            toast.loading(`Generating ${done + 1} / ${tot} statements…`, { id: toastId })
          }
        },
        pdfSettings,
        emailOptions,
        labelArtists,
        appDefaults,
        emailConfig,
        compilationFilters,
        excelSettings,
        wantsRawExcelSheet(excelSettings)
          ? (name, data, onProgress) =>
              requestExcelBlob?.({
                artist: name,
                artistData: data,
                labelInfo,
                periodStart: periodStart || undefined,
                periodEnd: periodEnd || undefined,
                compilationFilters,
                settings: excelSettings ?? pdfSettings,
              }, onProgress) ?? Promise.resolve(null)
          : undefined,
        (artist, phase, rows) => {
          const description =
            phase === 'summary'
              ? t.exportExcelProgressSummary
              : `${t.exportExcelProgressReports}${rows ? ` ${rows}` : ''}`
          toast.loading(`Generating ${Math.max(1, current)} / ${total} statements…`, {
            id: toastId,
            description: `${artist}: ${description}`,
          })
        },
        (artist) => skippedExcel.push(artist),
        startZipExport(),
      )
      downloadBlob(blob, 'selected_artist_statements.zip')
      toast.success(`${total} selected statement${total !== 1 ? 's' : ''} downloaded`, { id: toastId })
      if (skippedExcel.length > 0) {
        toast.warning(interpolate(t.exportExcelBatchSkipped, { count: skippedExcel.length }))
      }
    } catch (err) {
      const workerMessage = excelWorkerErrorMessage(err)
      if (workerMessage) {
        toast.error(workerMessage, { id: toastId })
        return
      }
      toast.error(t.exportZipFailed, { id: toastId, description: explainSosError(err, t) })
      console.error('ZIP export error:', err)
    }
  }, [processedData, labelInfo, periodStart, periodEnd, pdfSettings, emailOptions, labelArtists, appDefaults, emailConfig, compilationFilters, requestExcelBlob, t, excelWorkerErrorMessage, requirePeriod, startZipExport])

  const handlePublishToPortal = useCallback(
    async (artist: string) => {
      const artistData = processedData.find(d => d.artist === artist)
      if (!artistData) {
        toast.error(interpolate(t.exportNoArtistData, { artist }))
        return
      }
      if (!requirePeriod()) return
      if (!requireArchive()) return

      const artistInfo = artistInfoMap.get(artist.toLowerCase())

      try {
        if (!artistInfo?.artistId || !isValidArtistId(artistInfo.artistId)) {
          throw new Error(`Artist "${artist}" is not linked to a valid portal artist ID`)
        }

        const currentYear = new Date().getFullYear()
        const prefix = labelInfo.invoiceNumberPrefix ?? 'SOS'
        const artistSlug = artist.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4) || '0001'
        const invoiceNumber = `${prefix}-${currentYear}-${artistSlug}`

        const blob = await generatePDF(
          artistData,
          labelInfo,
          periodStart || undefined,
          periodEnd || undefined,
          invoiceNumber,
          pdfSettings,
          emailOptions,
          artistInfo,
          compilationFilters
        )

        const filename = `${createSafeFilename(artist)}_statement.pdf`
        const pdfBase64 = await blobToBase64(blob)
        const analyticsPayload = buildUploadPayload(artistData, periodStart, periodEnd)
        const { batchIds, primaryBatchId } = resolveBronzeBatchLineage(
          persistContext?.bronzeBatchIds,
        )
        const result = await uploadStatement({
          artistId: artistInfo.artistId,
          filename,
          period: periodStart,
          amountEur: artistData.finalPayout,
          ...analyticsPayload,
          batchId: primaryBatchId,
          pdfBase64,
          rulesFingerprint: persistContext?.rulesFingerprint,
          fxSnapshot: persistContext?.fxSnapshot,
          calculationSnapshot: buildCalculationSnapshot(
            artistData,
            analyticsPayload.totalStreams,
          ),
          sourceFileCount: persistContext?.sourceFileCount,
          archivedFileCount: persistContext?.archivedFileCount,
        })

        if (!result.success) {
          throw new Error(result.error ?? 'Failed to publish statement to portal')
        }

        if (
          persistContext &&
          periodStart &&
          (persistContext.territoryMetrics.length > 0 ||
            persistContext.merchOrderRows.length > 0)
        ) {
          await persistAnalyticsAfterStatementUpload({
            artistName: artist,
            periodStart,
            periodEnd: periodEnd || periodStart,
            territoryMetrics: persistContext.territoryMetrics,
            merchOrderRows: persistContext.merchOrderRows,
            labelArtists: labelArtists ?? [],
            revenues: persistContext.revenues,
            bronzeBatchIds: batchIds,
            batchId: primaryBatchId,
          })
        }

        toast.success(t.exportPortalDraftSaved)
      } catch (err) {
        toast.error(t.exportPublishFailed, { description: explainSosError(err, t) })
      }
    },
    [processedData, artistInfoMap, labelInfo, periodStart, periodEnd, pdfSettings, emailOptions, compilationFilters, persistContext, labelArtists, t, requirePeriod, requireArchive]
  )

  const buildCorrectionPdfBase64 = useCallback(
    async (artist: string, amountEur: number): Promise<string | null> => {
      const artistData = processedData.find((d) => d.artist === artist)
      if (!artistData) return null
      if (!isValidPeriodRange(periodStart, periodEnd)) return null

      const artistInfo = artistInfoMap.get(artist.toLowerCase())

      try {
        const currentYear = new Date().getFullYear()
        const prefix = labelInfo.invoiceNumberPrefix ?? 'SOS'
        const artistSlug = artist.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4) || '0001'
        const invoiceNumber = `${prefix}-${currentYear}-${artistSlug}`
        const correctedData = { ...artistData, finalPayout: amountEur }
        const blob = await generatePDF(
          correctedData,
          labelInfo,
          periodStart || undefined,
          periodEnd || undefined,
          invoiceNumber,
          pdfSettings,
          emailOptions,
          artistInfo,
          compilationFilters,
        )
        return blobToBase64(blob)
      } catch (err) {
        console.error('Correction PDF generation error:', err)
        return null
      }
    },
    [
      processedData,
      artistInfoMap,
      labelInfo,
      periodStart,
      periodEnd,
      pdfSettings,
      emailOptions,
      compilationFilters,
    ],
  )

  return {
    handleDownloadPDF,
    handleDownloadExcel,
    handleDownloadAll,
    handleDownloadSelected,
    handlePublishToPortal,
    buildCorrectionPdfBase64,
  }
}