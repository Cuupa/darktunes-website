'use client'

import { useCallback, useMemo, useState } from 'react'
import { useKV } from '@/hooks/useLocalKV'
import { toast } from 'sonner'
import { parseCSVContentStreaming } from '@/lib/sos/ingest/streaming-csv-parser'
import { parseShopifyCSV } from '@/lib/sos/ingest/shopify-parser'
import { extractPeriodBounds, uploadBronzeDistributorCsv } from '@/lib/sos/bronzeUpload'
import type { UploadedFile, FileProcessingState } from '@/lib/sos/types'

type FileType = 'believe' | 'bandcamp' | 'shopify' | 'printful' | 'darkmerch'

/**
 * Metadata stored in IndexedDB — excludes the raw CSV string to keep storage
 * footprint small. Raw data is held in React state (in-memory only).
 */
type UploadedFileMeta = Omit<UploadedFile, 'data'>

interface FileEventCallbacks {
  onFileAdded?: (file: UploadedFile, rowsParsed: number, rowsSkipped: number, uniqueArtists: number) => void
  onFileRemoved?: (id: string) => void
}

/**
 * Manages CSV file state for one upload zone type.
 * Handles add, remove, and replace with per-file progress tracking.
 *
 * Raw CSV strings are kept in React state (memory only) and are NOT persisted
 * to IndexedDB. Only file metadata (name, size, stats, etc.) is persisted.
 * This avoids storing hundreds of MB of text in the browser's storage.
 */
export function useFileManager(type: FileType, callbacks?: FileEventCallbacks) {
  // Metadata persisted in IndexedDB (no raw CSV data).
  const [fileMetas, setFileMetas] = useKV<UploadedFileMeta[]>(`${type}-files`, [])
  // Raw CSV strings kept in memory only — lost on page reload, no storage limit issues.
  const [fileDataMap, setFileDataMap] = useState<Record<string, string>>({})
  const [fileStates, setFileStates] = useState<Record<string, FileProcessingState>>({})

  // Merge metadata with in-memory raw data so consumers see a unified UploadedFile.
  const files = useMemo<UploadedFile[]>(
    () => (fileMetas ?? []).map(meta => ({ ...meta, data: fileDataMap[meta.id] })),
    [fileMetas, fileDataMap]
  )

  const setFileState = useCallback((id: string, state: Partial<FileProcessingState>) => {
    setFileStates(prev => ({
      ...prev,
      [id]: { ...prev[id], ...state },
    }))
  }, [])

  const removeFileState = useCallback((id: string) => {
    setFileStates(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const processAndStore = useCallback(
    async (rawFile: File, id: string): Promise<{ data: string; rowsParsed: number; rowsSkipped: number; uniqueArtists: number }> => {
      setFileState(id, { status: 'uploading', progress: 0 })

      // Detect UTF-16 BOM (0xFF 0xFE for LE, 0xFE 0xFF for BE) and decode
      // accordingly. Bandcamp exports CSV files in UTF-16 LE. The browser's
      // default rawFile.text() uses UTF-8 and would produce garbled output.
      const buffer = await rawFile.arrayBuffer()
      const firstBytes = new Uint8Array(buffer, 0, 2)
      let data: string
      if (firstBytes[0] === 0xFF && firstBytes[1] === 0xFE) {
        data = new TextDecoder('utf-16le').decode(buffer)
      } else if (firstBytes[0] === 0xFE && firstBytes[1] === 0xFF) {
        data = new TextDecoder('utf-16be').decode(buffer)
      } else {
        data = new TextDecoder('utf-8').decode(buffer)
      }

      // For Darkmerch XLSX files the UTF-8 decode above produced garbled binary.
      // Convert XLSX → CSV now so that fileDataMap and the worker both receive
      // a valid CSV string instead of binary noise.
      if (type === 'darkmerch' && rawFile.name.toLowerCase().endsWith('.xlsx')) {
        const { darkmerchXLSXtoCSV } = await import('@/lib/sos/ingest/darkmerch-parser')
        const csvText = await darkmerchXLSXtoCSV(buffer)
        if (csvText) {
          data = csvText
        } else {
          toast.warning(`"${rawFile.name}" could not be converted from XLSX — file may be corrupted or unsupported.`)
        }
      }

      // Store raw CSV in memory immediately so re-parse with alias changes works.
      setFileDataMap(prev => ({ ...prev, [id]: data }))

      setFileState(id, { status: 'processing', progress: 0 })

      let rowsParsed: number
      let rowsSkipped: number
      let uniqueArtists: number
      let salesMonths: string[] = []

      if (type === 'shopify') {
        const result = parseShopifyCSV(data)
        rowsParsed = result.transactions.length
        rowsSkipped = result.errors.length
        uniqueArtists = new Set(result.transactions.map(t => t.original_artist)).size
        salesMonths = result.transactions.map((t) => t.sales_month)
      } else if (type === 'printful') {
        // parsePrintfulCSV is imported lazily to keep the bundle lean in non-merch flows
        const { parsePrintfulCSV } = await import('@/lib/sos/ingest/printful-parser')
        const result = parsePrintfulCSV(data)
        rowsParsed = result.costs.length
        rowsSkipped = result.errors.length
        uniqueArtists = 0
      } else if (type === 'darkmerch') {
        // data is always valid CSV at this point: for XLSX files it was converted
        // above; for CSV files it was decoded from UTF-8 directly.
        const { parseDarkmerchCSV } = await import('@/lib/sos/ingest/darkmerch-parser')
        const result = parseDarkmerchCSV(data)
        rowsParsed = result.transactions.length
        rowsSkipped = result.errors.length
        uniqueArtists = new Set(result.transactions.map(t => t.original_artist).filter(Boolean)).size
        salesMonths = result.transactions.map((t) => t.sales_month)
      } else {
        const result = await parseCSVContentStreaming(data, type, progress => {
          setFileState(id, { progress: progress.percentage })
        })
        rowsParsed = result.transactions.length
        rowsSkipped = result.errors.length
        uniqueArtists = result.uniqueArtists.length
        salesMonths = result.transactions.map((t) => t.sales_month)
      }

      setFileState(id, { status: 'done', progress: 100 })

      const { periodStart, periodEnd } = extractPeriodBounds(salesMonths)
      void (async () => {
        setFileState(id, { bronzeStatus: 'uploading' })
        const bronze = await uploadBronzeDistributorCsv({
          distributor: type,
          filename: rawFile.name,
          csvContent: data,
          rowCount: rowsParsed,
          periodStart,
          periodEnd,
        })
        if (bronze) {
          setFileMetas((current) =>
            (current ?? []).map((f) =>
              f.id === id ? { ...f, bronzeBatchId: bronze.batchId } : f,
            ),
          )
          setFileState(id, { bronzeStatus: 'done' })
        } else {
          setFileState(id, { bronzeStatus: 'error' })
        }
      })()

      return { data, rowsParsed, rowsSkipped, uniqueArtists }
    },
    [type, setFileState, setFileMetas]
  )

  const addFiles = useCallback(
    async (rawFiles: File[]) => {
      if (rawFiles.length === 0) return

      const ids = rawFiles.map(() => crypto.randomUUID())

      // Optimistically show placeholders while reading/parsing.
      const placeholders: UploadedFileMeta[] = rawFiles.map((f, i) => ({
        id: ids[i],
        name: f.name,
        size: f.size,
        type,
        uploadedAt: new Date().toISOString(),
      }))

      setFileMetas(current => [...(current ?? []), ...placeholders])

      const results = await Promise.allSettled(
        rawFiles.map(async (rawFile, i) => {
          const id = ids[i]
          try {
            const { data, rowsParsed, rowsSkipped, uniqueArtists } = await processAndStore(rawFile, id)
            // Update metadata with parsed stats (no raw data stored in KV).
            setFileMetas(current =>
              (current ?? []).map(f =>
                f.id === id ? { ...f, rowsParsed, rowsSkipped, uniqueArtistsCount: uniqueArtists } : f
              )
            )
            // Notify parent for history logging.
            const uploadedFile: UploadedFile = {
              id,
              name: rawFile.name,
              size: rawFile.size,
              type,
              data,
              uploadedAt: new Date().toISOString(),
              rowsParsed,
              rowsSkipped,
              uniqueArtistsCount: uniqueArtists,
            }
            callbacks?.onFileAdded?.(uploadedFile, rowsParsed, rowsSkipped, uniqueArtists)
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to process file'
            setFileState(id, { status: 'error', progress: 0, error: message })
            toast.error(`Failed to process "${rawFile.name}"`, { description: message })
            throw err
          }
        })
      )

      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      if (succeeded > 0) {
        toast.success(
          succeeded === 1
            ? `"${rawFiles[0].name}" uploaded successfully`
            : `${succeeded} file(s) uploaded successfully`
        )
      }
      if (failed > 0) {
        toast.error(`${failed} file(s) failed to upload`)
      }
    },
    [type, processAndStore, setFileMetas, setFileState, callbacks]
  )

  const removeFile = useCallback(
    (id: string) => {
      setFileMetas(current => (current ?? []).filter(f => f.id !== id))
      setFileDataMap(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      removeFileState(id)
      callbacks?.onFileRemoved?.(id)
      toast.info('File removed')
    },
    [setFileMetas, removeFileState, callbacks]
  )

  const replaceFile = useCallback(
    async (id: string, rawFile: File) => {
      // Update metadata immediately so the user sees the new name.
      setFileMetas(current =>
        (current ?? []).map(f =>
          f.id === id ? { ...f, name: rawFile.name, size: rawFile.size } : f
        )
      )

      try {
        const { data, rowsParsed, rowsSkipped, uniqueArtists } = await processAndStore(rawFile, id)
        setFileMetas(current =>
          (current ?? []).map(f =>
            f.id === id ? { ...f, rowsParsed, rowsSkipped, uniqueArtistsCount: uniqueArtists } : f
          )
        )
        const uploadedFile: UploadedFile = {
          id,
          name: rawFile.name,
          size: rawFile.size,
          type,
          data,
          uploadedAt: new Date().toISOString(),
          rowsParsed,
          rowsSkipped,
          uniqueArtistsCount: uniqueArtists,
        }
        callbacks?.onFileAdded?.(uploadedFile, rowsParsed, rowsSkipped, uniqueArtists)
        toast.success(`"${rawFile.name}" replaced successfully`)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to process file'
        setFileState(id, { status: 'error', progress: 0, error: message })
        toast.error(`Failed to replace file`, { description: message })
      }
    },
    [processAndStore, setFileMetas, setFileState, type, callbacks]
  )

  /** Removes every file and clears all in-memory state for this manager. */
  const clearAll = useCallback(() => {
    setFileMetas([])
    setFileDataMap({})
    setFileStates({})
  }, [setFileMetas])

  return {
    files,
    fileStates,
    addFiles,
    removeFile,
    replaceFile,
    clearAll,
  }
}
