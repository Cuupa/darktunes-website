import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateExcel } from '@/lib/sos/export-utils'
import { normalizeExcelExportSettings } from '@/lib/sos/excelExportSettings'
import { ExcelExportWorkerError } from '@/lib/sos/excelExportError'
import { useExports } from './useSosExports'
import type { LabelArtist, LabelInfo, SafeProcessedArtistData } from '@/lib/sos/types'

const {
  mockToastSuccess,
  mockToastError,
  mockGeneratePDF,
  mockDownloadBlob,
  mockUploadStatement,
  mockIsValidArtistId,
  mockIsValidPeriodRange,
} = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockGeneratePDF: vi.fn(),
  mockDownloadBlob: vi.fn(),
  mockUploadStatement: vi.fn(),
  mockIsValidArtistId: vi.fn(),
  mockIsValidPeriodRange: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useMessages: () => ({ admin: { accounting: {} } }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
    loading: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  },
}))

vi.mock('@/lib/sos/export-utils', () => ({
  generatePDF: mockGeneratePDF,
  generateExcel: vi.fn(),
  downloadBlob: mockDownloadBlob,
  generateZipOfAllStatements: vi.fn(),
}))

vi.mock('@/lib/sos/validation', () => ({
  isValidArtistId: mockIsValidArtistId,
}))

vi.mock('@/lib/sos/accountingInputValidation', () => ({
  isValidPeriodRange: mockIsValidPeriodRange,
}))

vi.mock('../../app/portal/statements/_actions/uploadStatement', () => ({
  uploadStatement: mockUploadStatement,
}))

vi.mock('@/lib/sos/persistAfterStatementUpload', () => ({
  persistAnalyticsAfterStatementUpload: vi.fn(async () => undefined),
}))

const labelInfo: LabelInfo = { name: 'darkTunes', address: '', invoiceNumberPrefix: 'SOS' }

function makeProcessedArtist(artist: string): SafeProcessedArtistData {
  return {
    artist,
    finalPayout: 123.45,
    platformBreakdown: [],
    countryBreakdown: [],
  } as unknown as SafeProcessedArtistData
}

describe('useSosExports.handleDownloadPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGeneratePDF.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }))
    mockIsValidArtistId.mockReturnValue(true)
    mockIsValidPeriodRange.mockReturnValue(true)
  })

  it('downloads PDF locally without portal upload when autoUploadToPortal is false', async () => {
    const labelArtists: LabelArtist[] = [
      { id: '1', name: 'Artist One', artistId: '123e4567-e89b-12d3-a456-426614174000' },
    ]

    const { result } = renderHook(() =>
      useExports(
        [makeProcessedArtist('Artist One')],
        labelInfo,
        '2026-03',
        '2026-03',
        {},
        {},
        labelArtists,
        {},
        [],
        false,
      ),
    )

    await act(async () => {
      await result.current.handleDownloadPDF('Artist One')
    })

    expect(mockUploadStatement).not.toHaveBeenCalled()
    expect(mockDownloadBlob).toHaveBeenCalledOnce()
    expect(mockToastSuccess).toHaveBeenCalledWith('PDF for "Artist One" downloaded')
  })
})

describe('useSosExports.handlePublishToPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGeneratePDF.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }))
    mockIsValidArtistId.mockReturnValue(true)
    mockIsValidPeriodRange.mockReturnValue(true)
  })

  it('refuses to publish without a valid period and never invents a fallback quarter', async () => {
    mockIsValidPeriodRange.mockReturnValue(false)
    mockUploadStatement.mockResolvedValue({ success: true, statementId: 'stmt-123' })

    const labelArtists: LabelArtist[] = [
      { id: '1', name: 'Artist One', artistId: '123e4567-e89b-12d3-a456-426614174000' },
    ]

    const { result } = renderHook(() =>
      useExports(
        [makeProcessedArtist('Artist One')],
        labelInfo,
        'invalid-period',
        '2026-03',
        {},
        {},
        labelArtists,
        {},
        []
      )
    )

    await act(async () => {
      await result.current.handlePublishToPortal('Artist One')
    })

    expect(mockGeneratePDF).not.toHaveBeenCalled()
    expect(mockUploadStatement).not.toHaveBeenCalled()
    expect(mockDownloadBlob).not.toHaveBeenCalled()
    expect(mockToastError).toHaveBeenCalledWith(
      'Set a valid billing period (YYYY-MM) before exporting or publishing. Nothing was changed.',
    )
  })

  it('publishes with the resolved accounting period', async () => {
    mockUploadStatement.mockResolvedValue({ success: true, statementId: 'stmt-123' })

    const labelArtists: LabelArtist[] = [
      { id: '1', name: 'Artist One', artistId: '123e4567-e89b-12d3-a456-426614174000' },
    ]

    const { result } = renderHook(() =>
      useExports(
        [makeProcessedArtist('Artist One')],
        labelInfo,
        '2026-03',
        '2026-03',
        {},
        {},
        labelArtists,
        {},
        []
      )
    )

    await act(async () => {
      await result.current.handlePublishToPortal('Artist One')
    })

    expect(mockGeneratePDF).toHaveBeenCalledOnce()
    expect(mockUploadStatement).toHaveBeenCalledWith(
      expect.objectContaining({
        artistId: '123e4567-e89b-12d3-a456-426614174000',
        filename: 'Artist_One_statement.pdf',
        period: '2026-03',
        amountEur: 123.45,
        pdfBase64: expect.any(String),
      })
    )
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Draft statement saved to portal. Approve in Settlement Center to notify the artist.',
    )
  })

  it('attaches the calculation stand (rules/FX/snapshot) to the published statement', async () => {
    mockUploadStatement.mockResolvedValue({ success: true, statementId: 'stmt-123' })

    const labelArtists: LabelArtist[] = [
      { id: '1', name: 'Artist One', artistId: '123e4567-e89b-12d3-a456-426614174000' },
    ]

    const { result } = renderHook(() =>
      useExports(
        [makeProcessedArtist('Artist One')],
        labelInfo,
        '2026-03',
        '2026-03',
        {},
        {},
        labelArtists,
        {},
        [],
        false,
        {
          territoryMetrics: [],
          merchOrderRows: [],
          revenues: [],
          bronzeBatchIds: [],
          rulesFingerprint: 'rules-fp-1',
          fxSnapshot: { rates: { USD: 1.1 }, historical: {} },
        },
      )
    )

    await act(async () => {
      await result.current.handlePublishToPortal('Artist One')
    })

    expect(mockUploadStatement).toHaveBeenCalledWith(
      expect.objectContaining({
        rulesFingerprint: 'rules-fp-1',
        fxSnapshot: { rates: { USD: 1.1 }, historical: {} },
        calculationSnapshot: expect.objectContaining({ finalPayout: 123.45 }),
      }),
    )
  })

  it('blocks portal publish when session files are not archived', async () => {
    const labelArtists: LabelArtist[] = [
      { id: '1', name: 'Artist One', artistId: '123e4567-e89b-12d3-a456-426614174000' },
    ]
    const { result } = renderHook(() =>
      useExports(
        [makeProcessedArtist('Artist One')],
        labelInfo,
        '2026-03',
        '2026-03',
        {},
        {},
        labelArtists,
        {},
        [],
        false,
        {
          territoryMetrics: [],
          merchOrderRows: [],
          revenues: [],
          bronzeBatchIds: [],
          sourceFileCount: 2,
          archivedFileCount: 0,
        },
      ),
    )

    await act(async () => {
      await result.current.handlePublishToPortal('Artist One')
    })

    expect(mockUploadStatement).not.toHaveBeenCalled()
    expect(mockToastError).toHaveBeenCalledWith(
      'Archive every uploaded source file before creating a statement. Preview and Excel still work.',
    )
  })

  it('shows upload error and does not fall back to local download', async () => {
    mockUploadStatement.mockResolvedValue({ success: false, error: 'Portal unavailable' })
    const labelArtists: LabelArtist[] = [
      { id: '1', name: 'Artist One', artistId: '123e4567-e89b-12d3-a456-426614174000' },
    ]

    const { result } = renderHook(() =>
      useExports(
        [makeProcessedArtist('Artist One')],
        labelInfo,
        '2026-03',
        '2026-03',
        {},
        {},
        labelArtists,
        {},
        []
      )
    )

    await act(async () => {
      await result.current.handlePublishToPortal('Artist One')
    })

    expect(mockToastError).toHaveBeenCalledWith('The statement draft was not created.', {
      description: expect.stringContaining('did not say why'),
    })
    expect(mockDownloadBlob).not.toHaveBeenCalled()
  })
})

describe('useSosExports.buildCorrectionPdfBase64', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGeneratePDF.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }))
    mockIsValidPeriodRange.mockReturnValue(true)
  })

  it('returns base64 PDF with overridden payout amount', async () => {
    const { result } = renderHook(() =>
      useExports(
        [makeProcessedArtist('Artist One')],
        labelInfo,
        '2026-03',
        '2026-03',
        {},
        {},
        [],
        {},
        [],
      ),
    )

    let pdfBase64: string | null = null
    await act(async () => {
      pdfBase64 = await result.current.buildCorrectionPdfBase64('Artist One', 250.5)
    })

    expect(pdfBase64).toBeTruthy()
    expect(mockGeneratePDF).toHaveBeenCalledWith(
      expect.objectContaining({ finalPayout: 250.5 }),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      undefined,
      [],
    )
  })

  it('returns null when artist data is missing', async () => {
    const { result } = renderHook(() =>
      useExports([], labelInfo, '2026-03', '2026-03', {}, {}, [], {}, []),
    )

    let pdfBase64: string | null = 'pending'
    await act(async () => {
      pdfBase64 = await result.current.buildCorrectionPdfBase64('Missing Artist', 10)
    })

    expect(pdfBase64).toBeNull()
  })
})

describe('useSosExports.handleDownloadExcel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsValidPeriodRange.mockReturnValue(true)
  })

  it('downloads the worker-built workbook when Raw is on', async () => {
    const mockGenerateExcel = vi.mocked(generateExcel)
    const workerBlob = new Blob(['worker-xlsx'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const requestExcelBlob = vi.fn().mockResolvedValue(workerBlob)

    const { result } = renderHook(() =>
      useExports(
        [makeProcessedArtist('Artist One')],
        labelInfo,
        '2026-03',
        '2026-03',
        {},
        {},
        [],
        {},
        [],
        false,
        undefined,
        requestExcelBlob,
      ),
    )

    await act(async () => {
      await result.current.handleDownloadExcel('Artist One')
    })

    expect(requestExcelBlob).toHaveBeenCalledWith(
      expect.objectContaining({ artist: 'Artist One' }),
      expect.any(Function),
    )
    expect(mockGenerateExcel).not.toHaveBeenCalled()
    expect(mockDownloadBlob).toHaveBeenCalledWith(
      workerBlob,
      expect.stringMatching(/Artist_One_statement\.xlsx$/),
    )
  })

  it('does not ask the worker when the Raw sheet is off', async () => {
    const mockGenerateExcel = vi.mocked(generateExcel)
    mockGenerateExcel.mockResolvedValue(new Blob(['xlsx']))
    const requestExcelBlob = vi.fn().mockResolvedValue(new Blob(['worker']))

    const { result } = renderHook(() =>
      useExports(
        [makeProcessedArtist('Artist One')],
        labelInfo,
        '2026-03',
        '2026-03',
        {},
        {},
        [],
        {},
        [],
        false,
        undefined,
        requestExcelBlob,
      ),
    )

    await act(async () => {
      await result.current.handleDownloadExcel(
        'Artist One',
        normalizeExcelExportSettings({ sheets: { raw: false } }),
      )
    })

    expect(requestExcelBlob).not.toHaveBeenCalled()
    expect(mockGenerateExcel).toHaveBeenCalled()
    expect(mockDownloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.stringMatching(/summary-only\.xlsx$/),
    )
  })

  it('opens the fallback dialog instead of downloading when original-report tabs cannot be built', async () => {
    const mockGenerateExcel = vi.mocked(generateExcel)
    mockGenerateExcel.mockResolvedValue(new Blob(['xlsx']))
    const requestExcelBlob = vi.fn().mockResolvedValue(null)

    const { result } = renderHook(() =>
      useExports(
        [makeProcessedArtist('Artist One')],
        labelInfo,
        '2026-03',
        '2026-03',
        {},
        {},
        [],
        {},
        [],
        false,
        undefined,
        requestExcelBlob,
      ),
    )

    await act(async () => {
      await result.current.handleDownloadExcel('Artist One')
    })

    expect(requestExcelBlob).toHaveBeenCalled()
    expect(mockGenerateExcel).not.toHaveBeenCalled()
    expect(mockDownloadBlob).not.toHaveBeenCalled()
    expect(result.current.excelFallback).toEqual(
      expect.objectContaining({ artist: 'Artist One' }),
    )
    expect(result.current.excelFallback?.reason).toContain('incomplete statement')
  })

  it('offers the fallback with the timeout reason when the worker export times out', async () => {
    const requestExcelBlob = vi
      .fn()
      .mockRejectedValue(
        new ExcelExportWorkerError('Excel export timed out after 5 minutes', {
          code: 'EXCEL_TIMEOUT',
        }),
      )

    const { result } = renderHook(() =>
      useExports(
        [makeProcessedArtist('Artist One')],
        labelInfo,
        '2026-03',
        '2026-03',
        {},
        {},
        [],
        {},
        [],
        false,
        undefined,
        requestExcelBlob,
      ),
    )

    await act(async () => {
      await result.current.handleDownloadExcel('Artist One')
    })

    expect(result.current.excelFallback?.reason).toContain('stopped after 5 minutes')
    expect(mockDownloadBlob).not.toHaveBeenCalled()
  })

  it('offers the fallback with the raw-row limit and formatted numbers', async () => {
    const requestExcelBlob = vi.fn().mockRejectedValue(
      new ExcelExportWorkerError('Too many rows', {
        code: 'EXCEL_RAW_ROWS_LIMIT',
        rows: 2_345_678,
        limit: 1_500_000,
      }),
    )

    const { result } = renderHook(() =>
      useExports(
        [makeProcessedArtist('Artist One')],
        labelInfo,
        '2026-03',
        '2026-03',
        {},
        {},
        [],
        {},
        [],
        false,
        undefined,
        requestExcelBlob,
      ),
    )

    await act(async () => {
      await result.current.handleDownloadExcel('Artist One')
    })

    expect(result.current.excelFallback?.reason).toContain('2,345,678')
    expect(result.current.excelFallback?.reason).toContain('1,500,000')
  })

  it('opens the fallback when Raw is on and the worker is missing', async () => {
    const mockGenerateExcel = vi.mocked(generateExcel)
    mockGenerateExcel.mockResolvedValue(new Blob(['xlsx']))

    const { result } = renderHook(() =>
      useExports(
        [makeProcessedArtist('Artist One')],
        labelInfo,
        '2026-03',
        '2026-03',
      ),
    )

    await act(async () => {
      await result.current.handleDownloadExcel('Artist One')
    })

    expect(mockGenerateExcel).not.toHaveBeenCalled()
    expect(mockDownloadBlob).not.toHaveBeenCalled()
    expect(result.current.excelFallback?.reason).toContain('incomplete statement')
  })

  it('offers the fallback with the stale-revision reason', async () => {
    const requestExcelBlob = vi.fn().mockRejectedValue(
      new ExcelExportWorkerError('stale', { code: 'EXCEL_STALE_REVISION' }),
    )

    const { result } = renderHook(() =>
      useExports(
        [makeProcessedArtist('Artist One')],
        labelInfo,
        '2026-03',
        '2026-03',
        {},
        {},
        [],
        {},
        [],
        false,
        undefined,
        requestExcelBlob,
      ),
    )

    await act(async () => {
      await result.current.handleDownloadExcel('Artist One')
    })

    expect(mockDownloadBlob).not.toHaveBeenCalled()
    expect(result.current.excelFallback?.reason).toContain('sales files or rules changed')
  })

  it('downloads an explicitly named summary-only workbook from the fallback dialog', async () => {
    const mockGenerateExcel = vi.mocked(generateExcel)
    const summaryBlob = new Blob(['summary'])
    mockGenerateExcel.mockResolvedValue(summaryBlob)
    const requestExcelBlob = vi
      .fn()
      .mockRejectedValue(new ExcelExportWorkerError('Missing original-report tabs: believe'))

    const { result } = renderHook(() =>
      useExports(
        [makeProcessedArtist('Artist One')],
        labelInfo,
        '2026-03',
        '2026-03',
        {},
        {},
        [],
        {},
        [],
        false,
        undefined,
        requestExcelBlob,
      ),
    )

    await act(async () => {
      await result.current.handleDownloadExcel('Artist One')
    })
    expect(result.current.excelFallback).not.toBeNull()

    await act(async () => {
      await result.current.resolveExcelFallback('summary')
    })

    expect(mockGenerateExcel).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      [],
    )
    expect(mockDownloadBlob).toHaveBeenCalledWith(
      summaryBlob,
      expect.stringMatching(/Artist_One_statement_summary-only\.xlsx$/),
    )
    expect(result.current.excelFallback).toBeNull()
  })

  it('retries the full export from the fallback dialog', async () => {
    const workerBlob = new Blob(['worker-xlsx'])
    const requestExcelBlob = vi
      .fn()
      .mockRejectedValueOnce(
        new ExcelExportWorkerError('no data', { code: 'EXCEL_WORKER_DATA_MISSING' }),
      )
      .mockResolvedValueOnce(workerBlob)

    const { result } = renderHook(() =>
      useExports(
        [makeProcessedArtist('Artist One')],
        labelInfo,
        '2026-03',
        '2026-03',
        {},
        {},
        [],
        {},
        [],
        false,
        undefined,
        requestExcelBlob,
      ),
    )

    await act(async () => {
      await result.current.handleDownloadExcel('Artist One')
    })
    expect(result.current.excelFallback).not.toBeNull()

    await act(async () => {
      await result.current.resolveExcelFallback('retry')
    })

    expect(requestExcelBlob).toHaveBeenCalledTimes(2)
    expect(mockDownloadBlob).toHaveBeenCalledWith(
      workerBlob,
      expect.stringMatching(/Artist_One_statement\.xlsx$/),
    )
    expect(result.current.excelFallback).toBeNull()
  })

  it('cancels the fallback without downloading anything', async () => {
    const mockGenerateExcel = vi.mocked(generateExcel)
    const requestExcelBlob = vi.fn().mockResolvedValue(null)

    const { result } = renderHook(() =>
      useExports(
        [makeProcessedArtist('Artist One')],
        labelInfo,
        '2026-03',
        '2026-03',
        {},
        {},
        [],
        {},
        [],
        false,
        undefined,
        requestExcelBlob,
      ),
    )

    await act(async () => {
      await result.current.handleDownloadExcel('Artist One')
    })
    await act(async () => {
      await result.current.resolveExcelFallback('cancel')
    })

    expect(result.current.excelFallback).toBeNull()
    expect(mockGenerateExcel).not.toHaveBeenCalled()
    expect(mockDownloadBlob).not.toHaveBeenCalled()
  })

  it('does not open the fallback dialog when the export was cancelled', async () => {
    const requestExcelBlob = vi
      .fn()
      .mockRejectedValue(new ExcelExportWorkerError('cancelled', { code: 'EXCEL_CANCELLED' }))

    const { result } = renderHook(() =>
      useExports(
        [makeProcessedArtist('Artist One')],
        labelInfo,
        '2026-03',
        '2026-03',
        {},
        {},
        [],
        {},
        [],
        false,
        undefined,
        requestExcelBlob,
      ),
    )

    await act(async () => {
      await result.current.handleDownloadExcel('Artist One')
    })

    expect(result.current.excelFallback).toBeNull()
    expect(mockDownloadBlob).not.toHaveBeenCalled()
  })
})
