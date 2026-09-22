import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCSVProcessor } from './useSosCSVProcessor'

const {
  mockFetchExchangeRates,
  mockFetchHistoricalExchangeRates,
  mockComputeAutoMappings,
  mockToastSuccess,
  mockToastWarning,
  mockToastError,
} = vi.hoisted(() => ({
  mockFetchExchangeRates: vi.fn(),
  mockFetchHistoricalExchangeRates: vi.fn(),
  mockComputeAutoMappings: vi.fn(() => []),
  mockToastSuccess: vi.fn(),
  mockToastWarning: vi.fn(),
  mockToastError: vi.fn(),
}))

vi.mock('next-intl', () => {
  const t = (key: string) => key
  return { useTranslations: () => t }
})

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    warning: mockToastWarning,
    error: mockToastError,
  },
}))

vi.mock('@/lib/sos/auto-mapping', () => ({
  computeAutoMappings: mockComputeAutoMappings,
}))

vi.mock('@/lib/sos/clientAppLog', () => ({
  logClientAppEvent: vi.fn(),
}))

vi.mock('@/lib/sos/currency', () => ({
  fetchExchangeRates: mockFetchExchangeRates,
  fetchHistoricalExchangeRates: mockFetchHistoricalExchangeRates,
  FALLBACK_EXCHANGE_RATES: { USD: 1.08 },
  parseMissingExchangeRateCurrency: (message: string) => {
    const match = message.match(/Missing exchange rate for currency "([A-Z]{3})"/i)
    return match?.[1] ?? null
  },
}))

vi.mock('@/lib/i18n/interpolate', () => ({
  interpolate: (template: string, vars: Record<string, string | number>) =>
    Object.entries(vars).reduce(
      (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
      template,
    ),
}))

class WorkerMock {
  public onmessage: ((event: MessageEvent) => void) | null = null
  public onerror: ((event: ErrorEvent) => void) | null = null
  public postMessage = vi.fn()
  public terminate = vi.fn()
}

const workerInstances: WorkerMock[] = []

function makeConfig() {
  return {
    compilationFilters: [],
    artistMappings: [],
    splitFees: [],
    manualRevenues: [],
    expenses: [],
    excludePhysical: false,
    csvAliases: [],
    labelArtists: [],
    ignoredEntries: [],
    distributionFeePercentage: 0,
  }
}

describe('useCSVProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    workerInstances.length = 0
    mockFetchExchangeRates.mockResolvedValue({ source: 'ecb', rates: { USD: 1.1 } })
    mockFetchHistoricalExchangeRates.mockResolvedValue({ source: 'ecb', rates: {} })

    class MockWorker extends WorkerMock {
      constructor() {
        super()
        workerInstances.push(this)
      }
    }

    vi.stubGlobal('Worker', MockWorker)
  })

  it('starts with idle initial state when no files are provided', async () => {
    const { result } = renderHook(() => useCSVProcessor([], [], makeConfig()))

    await waitFor(() => {
      expect(result.current.exchangeRatesLoading).toBe(false)
    })

    expect(result.current.isProcessing).toBe(false)
    expect(result.current.processedData).toEqual([])
    expect(result.current.revenues).toEqual([])
    expect(workerInstances).toHaveLength(1)
  })

  it('handles worker error path and exits processing state', async () => {
    const file = {
      id: 'f-1',
      name: 'believe.csv',
      size: 10,
      type: 'believe' as const,
      data: 'artist,revenue\nA,10',
      uploadedAt: '2026-01-01T00:00:00.000Z',
    }

    const { result } = renderHook(() => useCSVProcessor([file], [], makeConfig()))

    await waitFor(() => {
      expect(result.current.isProcessing).toBe(true)
    })

    const worker = workerInstances[0]
    await act(async () => {
      worker?.onmessage?.({
        data: { type: 'error', fileId: 'f-1', message: 'invalid csv' },
      } as MessageEvent)
    })

    expect(mockToastError).toHaveBeenCalledWith('csvProcessingError', {
      description: 'explainUnknown',
    })
    expect(result.current.isProcessing).toBe(false)
  })

  it('forwards worker parse-progress and parse-done to ingest callbacks', async () => {
    const onParseProgress = vi.fn()
    const onParseDone = vi.fn()
    const file = {
      id: 'f-progress',
      name: 'believe.csv',
      size: 10,
      type: 'believe' as const,
      data: 'artist,revenue\nA,10',
      uploadedAt: '2026-01-01T00:00:00.000Z',
    }

    renderHook(() =>
      useCSVProcessor([file], [], makeConfig(), [], [], [], {
        onParseProgress,
        onParseDone,
      }),
    )

    await waitFor(() => {
      expect(workerInstances).toHaveLength(1)
    })

    const worker = workerInstances[0]
    await act(async () => {
      worker?.onmessage?.({
        data: {
          type: 'parse-progress',
          fileId: 'f-progress',
          phase: 'parsing',
          percentage: 40,
          processedRows: 40000,
          totalRows: 100000,
        },
      } as MessageEvent)
    })
    expect(onParseProgress).toHaveBeenCalledWith({
      fileId: 'f-progress',
      phase: 'parsing',
      percentage: 40,
      processedRows: 40000,
      totalRows: 100000,
    })

    await act(async () => {
      worker?.onmessage?.({
        data: {
          type: 'parse-done',
          fileId: 'f-progress',
          rowsParsed: 100000,
          rowsSkipped: 2,
          uniqueArtistsCount: 8,
          periodStart: '2025-10',
          periodEnd: '2026-03',
        },
      } as MessageEvent)
    })
    expect(onParseDone).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: 'f-progress',
        rowsParsed: 100000,
        periodStart: '2025-10',
      }),
    )
  })

  it('forwards worker parse-progress and parse-done to ingest callbacks', async () => {
    const onParseProgress = vi.fn()
    const onParseDone = vi.fn()
    const file = {
      id: 'f-progress',
      name: 'believe.csv',
      size: 10,
      type: 'believe' as const,
      data: 'artist,revenue\nA,10',
      uploadedAt: '2026-01-01T00:00:00.000Z',
    }

    renderHook(() =>
      useCSVProcessor([file], [], makeConfig(), [], [], [], {
        onParseProgress,
        onParseDone,
      }),
    )

    await waitFor(() => {
      expect(workerInstances).toHaveLength(1)
    })

    const worker = workerInstances[0]
    await act(async () => {
      worker?.onmessage?.({
        data: {
          type: 'parse-progress',
          fileId: 'f-progress',
          phase: 'parsing',
          percentage: 40,
          processedRows: 40000,
          totalRows: 100000,
        },
      } as MessageEvent)
    })
    expect(onParseProgress).toHaveBeenCalledWith({
      fileId: 'f-progress',
      phase: 'parsing',
      percentage: 40,
      processedRows: 40000,
      totalRows: 100000,
    })

    await act(async () => {
      worker?.onmessage?.({
        data: {
          type: 'parse-done',
          fileId: 'f-progress',
          rowsParsed: 100000,
          rowsSkipped: 2,
          uniqueArtistsCount: 8,
          periodStart: '2025-10',
          periodEnd: '2026-03',
        },
      } as MessageEvent)
    })
    expect(onParseDone).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: 'f-progress',
        rowsParsed: 100000,
        periodStart: '2025-10',
      }),
    )
  })

  it('does not process until exchange rates are ready', async () => {
    let resolveRates: (value: { source: string; rates: Record<string, number> }) => void = () => {}
    mockFetchExchangeRates.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRates = resolve
        }),
    )

    const file = {
      id: 'f-rates',
      name: 'believe.csv',
      size: 10,
      type: 'believe' as const,
      data: 'artist,revenue\nA,10',
      uploadedAt: '2026-01-01T00:00:00.000Z',
    }

    const { result } = renderHook(() => useCSVProcessor([file], [], makeConfig()))

    await waitFor(() => {
      expect(workerInstances).toHaveLength(1)
    })

    const worker = workerInstances[0]
    const processCallsBefore = worker?.postMessage.mock.calls.filter(
      (c) => (c[0] as { type?: string })?.type === 'process',
    ).length

    expect(result.current.exchangeRatesReady).toBe(false)
    expect(processCallsBefore).toBe(0)

    await act(async () => {
      resolveRates({ source: 'ecb', rates: { USD: 1.1 } })
    })

    await waitFor(() => {
      expect(result.current.exchangeRatesReady).toBe(true)
    })
  })

  it('processes worker success result and maps revenues', async () => {
    const file = {
      id: 'f-2',
      name: 'believe.csv',
      size: 12,
      type: 'believe' as const,
      data: 'artist,revenue\nA,12',
      uploadedAt: '2026-01-01T00:00:00.000Z',
    }

    const { result } = renderHook(() => useCSVProcessor([file], [], makeConfig()))

    await waitFor(() => {
      expect(result.current.isProcessing).toBe(true)
    })

    const worker = workerInstances[0]
    const payload = {
      type: 'result',
      data: {
        processedData: [
          {
            artist: 'Artist A',
            believeRevenue: 12,
            bandcampRevenue: 0,
            darkmerchRevenue: 0,
            manualRevenue: 0,
            grossRevenue: 12,
            splitPercentage: 50,
            finalPayout: 6,
            totalQuantity: 1,
            totalExpenses: 0,
            distributionFeeDeducted: 0,
            totalStreamRevenue: 0,
            totalDownloadRevenue: 12,
            platformBreakdown: [],
            countryBreakdown: [],
            monthlyBreakdown: [],
            releaseBreakdown: [],
            totalPhysicalRevenue: 0,
          },
        ],
        artistTrees: [],
        collabTree: [],
        filteredCompilations: [],
        uniqueArtists: ['Artist A'],
        periodStart: '2026-01',
        periodEnd: '2026-01',
        totalGrossAllData: 12,
        releaseTitlesByArtistIncFeaturing: {},
        territoryMetrics: [],
        merchOrderRows: [],
      },
    }

    await act(async () => {
      worker?.onmessage?.({ data: payload } as MessageEvent)
    })

    await waitFor(() => {
      expect(result.current.isProcessing).toBe(false)
      expect(result.current.processedData).toHaveLength(1)
    })

    expect(result.current.uniqueArtists).toEqual(['Artist A'])
    expect(result.current.revenues[0]?.artist).toBe('Artist A')
    expect(result.current.revenues[0]?.finalAmount).toBe(6)
  })

  it('requestExcelBlob resolves a transferred workbook buffer', async () => {
    const { result } = renderHook(() => useCSVProcessor([], [], makeConfig()))

    await waitFor(() => {
      expect(workerInstances).toHaveLength(1)
    })

    const worker = workerInstances[0]
    const artistData = { artist: 'Reaper' } as never
    let blobPromise: Promise<Blob | null> | undefined
    await act(async () => {
      blobPromise = result.current.requestExcelBlob({
        artist: 'Reaper',
        artistData,
        labelInfo: { name: 'darkTunes', address: '' },
        compilationFilters: [],
      })
    })

    const posted = worker?.postMessage.mock.calls.find(
      (c) => (c[0] as { type?: string })?.type === 'build-excel',
    )?.[0] as { type: string; artist: string; requestId: string } | undefined
    expect(posted?.artist).toBe('Reaper')
    expect(posted?.requestId).toBeTruthy()

    let blob: Blob | null | undefined
    await act(async () => {
      worker?.onmessage?.({
        data: {
          type: 'excel-done',
          requestId: posted?.requestId,
          kind: 'xlsx',
          buffer: new Uint8Array([1, 2, 3]).buffer,
        },
      } as MessageEvent)
      blob = await blobPromise
    })

    expect(blob).toBeInstanceOf(Blob)
    expect((blob as Blob).size).toBe(3)
    expect((blob as Blob).type).toContain('spreadsheetml.sheet')
  })

  it('requestExcelBlob rejects when the worker reports excel-error', async () => {
    const { result } = renderHook(() => useCSVProcessor([], [], makeConfig()))

    await waitFor(() => {
      expect(workerInstances).toHaveLength(1)
    })

    const worker = workerInstances[0]
    let blobPromise: Promise<Blob | null> | undefined
    await act(async () => {
      blobPromise = result.current.requestExcelBlob({
        artist: 'Reaper',
        artistData: { artist: 'Reaper' } as never,
        labelInfo: { name: 'darkTunes', address: '' },
        compilationFilters: [],
      })
    })

    const posted = worker?.postMessage.mock.calls.find(
      (c) => (c[0] as { type?: string })?.type === 'build-excel',
    )?.[0] as { requestId: string } | undefined

    const rejected = expect(blobPromise).rejects.toThrow('Missing original-report tabs: believe')
    await act(async () => {
      worker?.onmessage?.({
        data: {
          type: 'excel-error',
          requestId: posted?.requestId,
          message: 'Missing original-report tabs: believe',
        },
      } as MessageEvent)
    })
    await rejected
  })

  it('requestExcelBlob rejects with EXCEL_TIMEOUT and marks the worker busy', async () => {
    const { result } = renderHook(() => useCSVProcessor([], [], makeConfig()))

    await waitFor(() => {
      expect(workerInstances).toHaveLength(1)
    })

    const controller = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal)

    let pending: Promise<Blob | null> | undefined
    await act(async () => {
      pending = result.current.requestExcelBlob({
        artist: 'Reaper',
        artistData: { artist: 'Reaper' } as never,
        labelInfo: { name: 'darkTunes', address: '' },
        compilationFilters: [],
      })
    })

    const rejected = expect(pending).rejects.toMatchObject({
      name: 'ExcelExportWorkerError',
      code: 'EXCEL_TIMEOUT',
    })
    await act(async () => {
      controller.abort()
    })
    await rejected

    expect(result.current.excelBusy).toBe(true)
    vi.mocked(AbortSignal.timeout).mockRestore()
  })

  it('requestExcelBlob posts the current process revision', async () => {
    const { result } = renderHook(() => useCSVProcessor([], [], makeConfig()))

    await waitFor(() => {
      expect(workerInstances).toHaveLength(1)
    })

    await act(async () => {
      void result.current.requestExcelBlob({
        artist: 'Reaper',
        artistData: { artist: 'Reaper' } as never,
        labelInfo: { name: 'darkTunes', address: '' },
        compilationFilters: [],
      })
    })

    const posted = workerInstances[0]?.postMessage.mock.calls.find(
      (c) => (c[0] as { type?: string })?.type === 'build-excel',
    )?.[0] as { inputRevision?: number } | undefined
    expect(posted?.inputRevision).toBe(0)
  })

  it('rejects a second Excel export while one is running', async () => {
    const { result } = renderHook(() => useCSVProcessor([], [], makeConfig()))

    await waitFor(() => {
      expect(workerInstances).toHaveLength(1)
    })

    await act(async () => {
      void result.current.requestExcelBlob({
        artist: 'Reaper',
        artistData: { artist: 'Reaper' } as never,
        labelInfo: { name: 'darkTunes', address: '' },
        compilationFilters: [],
      })
    })

    await expect(
      result.current.requestExcelBlob({
        artist: 'Other',
        artistData: { artist: 'Other' } as never,
        labelInfo: { name: 'darkTunes', address: '' },
        compilationFilters: [],
      }),
    ).rejects.toMatchObject({ code: 'EXCEL_BUSY' })
  })

  it('cancelExcelExport rejects the pending job and recreates the worker', async () => {
    const { result } = renderHook(() => useCSVProcessor([], [], makeConfig()))

    await waitFor(() => {
      expect(workerInstances).toHaveLength(1)
    })

    const worker = workerInstances[0]
    let pending: Promise<Blob | null> | undefined
    await act(async () => {
      pending = result.current.requestExcelBlob({
        artist: 'Reaper',
        artistData: { artist: 'Reaper' } as never,
        labelInfo: { name: 'darkTunes', address: '' },
        compilationFilters: [],
      })
    })

    const rejected = expect(pending).rejects.toMatchObject({ code: 'EXCEL_CANCELLED' })
    await act(async () => {
      result.current.cancelExcelExport()
    })
    await rejected
    expect(worker?.terminate).toHaveBeenCalled()
    expect(result.current.excelBusy).toBe(false)
  })

  it('rebuilds raw rows and retries once when the worker lost the processed data', async () => {
    const file = {
      id: 'f-retry',
      name: 'believe.csv',
      size: 10,
      type: 'believe' as const,
      data: 'artist,revenue\nA,10',
      uploadedAt: '2026-01-01T00:00:00.000Z',
    }

    const config = makeConfig()
    const { result } = renderHook(() => useCSVProcessor([file], [], config))

    await waitFor(() => {
      expect(workerInstances).toHaveLength(1)
    })

    const worker = workerInstances[0]
    let pending: Promise<Blob | null> | undefined
    await act(async () => {
      pending = result.current.requestExcelBlob({
        artist: 'Reaper',
        artistData: { artist: 'Reaper' } as never,
        labelInfo: { name: 'darkTunes', address: '' },
        compilationFilters: [],
      })
    })

    const firstBuild = worker?.postMessage.mock.calls.find(
      (c) => (c[0] as { type?: string })?.type === 'build-excel',
    )?.[0] as { requestId: string } | undefined

    await act(async () => {
      worker?.onmessage?.({
        data: {
          type: 'excel-error',
          requestId: firstBuild?.requestId,
          code: 'EXCEL_WORKER_DATA_MISSING',
          message: 'No processed data in the export worker.',
        },
      } as MessageEvent)
    })

    await act(async () => {
      worker?.onmessage?.({
        data: {
          type: 'parse-done',
          fileId: 'f-retry',
          rowsParsed: 1,
          rowsSkipped: 0,
          uniqueArtistsCount: 1,
          periodStart: '2026-01',
          periodEnd: '2026-01',
        },
      } as MessageEvent)
    })

    const processCall = worker?.postMessage.mock.calls.find(
      (c) => (c[0] as { type?: string; requestId?: number })?.type === 'process',
    )?.[0] as { requestId?: number } | undefined
    expect(processCall?.requestId).toBe(1)

    await act(async () => {
      worker?.onmessage?.({
        data: {
          type: 'result',
          requestId: processCall?.requestId,
          data: {
            processedData: [],
            artistTrees: [],
            collabTree: [],
            filteredCompilations: [],
            uniqueArtists: [],
            periodStart: '',
            periodEnd: '',
            totalGrossAllData: 0,
            releaseTitlesByArtistIncFeaturing: {},
            territoryMetrics: [],
            merchOrderRows: [],
          },
        },
      } as MessageEvent)
    })

    await waitFor(() => {
      const buildCalls = worker?.postMessage.mock.calls.filter(
        (c) => (c[0] as { type?: string })?.type === 'build-excel',
      )
      expect(buildCalls).toHaveLength(2)
    })
    const secondBuild = worker?.postMessage.mock.calls.filter(
      (c) => (c[0] as { type?: string })?.type === 'build-excel',
    )[1]?.[0] as { requestId: string } | undefined
    expect(secondBuild?.requestId).toBeTruthy()
    expect(secondBuild?.requestId).not.toBe(firstBuild?.requestId)

    let blob: Blob | null | undefined
    await act(async () => {
      worker?.onmessage?.({
        data: {
          type: 'excel-done',
          requestId: secondBuild?.requestId,
          kind: 'xlsx',
          buffer: new Uint8Array([7, 8]).buffer,
        },
      } as MessageEvent)
      blob = await pending
    })

    expect(blob).toBeInstanceOf(Blob)
    expect((blob as Blob).size).toBe(2)
  })

  it('fails the export retry immediately when the worker holds no files', async () => {
    const { result } = renderHook(() => useCSVProcessor([], [], makeConfig()))

    await waitFor(() => {
      expect(workerInstances).toHaveLength(1)
    })

    const worker = workerInstances[0]
    let pending: Promise<Blob | null> | undefined
    await act(async () => {
      pending = result.current.requestExcelBlob({
        artist: 'Reaper',
        artistData: { artist: 'Reaper' } as never,
        labelInfo: { name: 'darkTunes', address: '' },
        compilationFilters: [],
      })
    })

    const posted = worker?.postMessage.mock.calls.find(
      (c) => (c[0] as { type?: string })?.type === 'build-excel',
    )?.[0] as { requestId: string } | undefined

    const rejected = expect(pending!).rejects.toMatchObject({
      code: 'EXCEL_WORKER_DATA_MISSING',
    })
    await act(async () => {
      worker?.onmessage?.({
        data: {
          type: 'excel-error',
          requestId: posted?.requestId,
          code: 'EXCEL_WORKER_DATA_MISSING',
          message: 'No processed data in the export worker.',
        },
      } as MessageEvent)
    })
    await rejected

    expect(
      worker?.postMessage.mock.calls.filter(
        (c) => (c[0] as { type?: string })?.type === 'process',
      ),
    ).toHaveLength(0)
    expect(result.current.excelBusy).toBe(false)
  })
})
