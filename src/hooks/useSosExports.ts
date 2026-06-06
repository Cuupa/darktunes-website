'use client'

import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import {
  generatePDF,
  generateExcel,
  downloadBlob,
  generateZipOfAllStatements,
} from '@/lib/sos/export-utils'
import { createSafeFilename } from '@/lib/sos/utils'
import { uploadStatementPdf, isValidArtistId, isValidPeriod } from '@/lib/sos/sosWebhook'
import type { SafeProcessedArtistData, LabelInfo, PdfExportSettings, AppDefaults, LabelArtist, EmailConfig, CompilationFilter } from '@/lib/sos/types'

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
  sosWebhookUrl = '',
  sosWebhookSecret = '',
  autoUploadToPortal = true
) {
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
        toast.error(`No data found for artist "${artist}"`)
        return
      }

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

        // Attempt webhook upload if configured and auto-upload is enabled
        const shouldUpload =
          autoUploadToPortal &&
          sosWebhookUrl.trim() !== '' &&
          sosWebhookSecret.trim() !== '' &&
          artistInfo?.artistId != null &&
          isValidArtistId(artistInfo.artistId)

        if (shouldUpload && artistInfo?.artistId) {
          const period = periodStart || String(new Date().getFullYear())
          const filename = `${createSafeFilename(artist)}_statement.pdf`
          // If period doesn't match expected format (YYYY-MM or Q{N}-YYYY), fall back to current year
          const validPeriod = isValidPeriod(period) ? period : `Q1-${new Date().getFullYear()}`

          toast.loading('Uploading statement to portal…', { id: 'sos-upload' })

          const result = await uploadStatementPdf(
            {
              artistId: artistInfo.artistId,
              filename,
              period: validPeriod,
              amountEur: artistData.finalPayout,
            },
            blob,
            sosWebhookUrl,
            sosWebhookSecret
          )

          if (result.success) {
            toast.success('Statement uploaded! Artist will receive an email notification.', { id: 'sos-upload' })
          } else {
            toast.error(`Upload failed: ${result.error ?? 'Unknown error'}. PDF saved locally instead.`, { id: 'sos-upload' })
            downloadBlob(blob, `${createSafeFilename(artist)}_statement.pdf`)
          }
        } else {
          downloadBlob(blob, `${createSafeFilename(artist)}_statement.pdf`)
          toast.success(`PDF for "${artist}" downloaded`)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        toast.error('PDF export failed', { description: message })
        console.error('PDF export error:', err)
      }
    },
    [processedData, labelInfo, periodStart, periodEnd, pdfSettings, emailOptions, artistInfoMap, compilationFilters, sosWebhookUrl, sosWebhookSecret, autoUploadToPortal]
  )

  const handleDownloadExcel = useCallback(
    async (artist: string) => {
      const artistData = processedData.find(d => d.artist === artist)
      if (!artistData) {
        toast.error(`No data found for artist "${artist}"`)
        return
      }

      try {
        const blob = await generateExcel(
          artistData,
          labelInfo,
          periodStart || undefined,
          periodEnd || undefined,
          compilationFilters,
          pdfSettings
        )
        downloadBlob(blob, `${createSafeFilename(artist)}_statement.xlsx`)
        toast.success(`Excel for "${artist}" downloaded`)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        toast.error('Excel export failed', { description: message })
        console.error('Excel export error:', err)
      }
    },
    [processedData, labelInfo, periodStart, periodEnd, compilationFilters, pdfSettings]
  )

  /**
   * Queued batch export — generates one document at a time so the browser
   * never tries to build hundreds of PDFs simultaneously. Progress is shown
   * via an updating sonner toast so the user sees exactly how far along the
   * export is without the tab freezing.
   */
  const handleDownloadAll = useCallback(async () => {
    if (processedData.length === 0) {
      toast.info('No revenue data to export')
      return
    }

    const total = processedData.length
    const toastId = toast.loading(`Preparing 1 / ${total} statements…`)
    try {
      const blob = await generateZipOfAllStatements(
        processedData,
        labelInfo,
        periodStart || undefined,
        periodEnd || undefined,
        'both',
        (done, tot) => {
          if (done < tot) {
            toast.loading(`Generating ${done + 1} / ${tot} statements…`, { id: toastId })
          }
        },
        pdfSettings,
        emailOptions,
        labelArtists,
        appDefaults,
        emailConfig,
        compilationFilters
      )
      downloadBlob(blob, 'artist_statements.zip')
      toast.success(`All ${total} statements downloaded`, { id: toastId })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error('ZIP export failed', { id: toastId, description: message })
      console.error('ZIP export error:', err)
    }
  }, [processedData, labelInfo, periodStart, periodEnd, pdfSettings, emailOptions, labelArtists, appDefaults, emailConfig, compilationFilters])

  /**
   * Queued batch export for a specific subset of artists — same async queue
   * as handleDownloadAll but filters processedData to only the provided names.
   */
  const handleDownloadSelected = useCallback(async (selectedArtistNames: string[]) => {
    if (selectedArtistNames.length === 0) {
      toast.info('No artists selected for export')
      return
    }

    const subset = processedData.filter(d => selectedArtistNames.includes(d.artist))
    if (subset.length === 0) {
      toast.error('No matching processed data for selected artists')
      return
    }

    const total = subset.length
    const toastId = toast.loading(`Preparing 1 / ${total} statements…`)
    try {
      const blob = await generateZipOfAllStatements(
        subset,
        labelInfo,
        periodStart || undefined,
        periodEnd || undefined,
        'both',
        (done, tot) => {
          if (done < tot) {
            toast.loading(`Generating ${done + 1} / ${tot} statements…`, { id: toastId })
          }
        },
        pdfSettings,
        emailOptions,
        labelArtists,
        appDefaults,
        emailConfig,
        compilationFilters
      )
      downloadBlob(blob, 'selected_artist_statements.zip')
      toast.success(`${total} selected statement${total !== 1 ? 's' : ''} downloaded`, { id: toastId })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error('ZIP export failed', { id: toastId, description: message })
      console.error('ZIP export error:', err)
    }
  }, [processedData, labelInfo, periodStart, periodEnd, pdfSettings, emailOptions, labelArtists, appDefaults, emailConfig, compilationFilters])

  return { handleDownloadPDF, handleDownloadExcel, handleDownloadAll, handleDownloadSelected }
}
