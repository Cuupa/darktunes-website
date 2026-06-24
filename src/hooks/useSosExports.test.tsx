import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useExports } from './useSosExports'
import type { LabelArtist, LabelInfo, SafeProcessedArtistData } from '@/lib/sos/types'

const {
  mockToastSuccess,
  mockToastError,
  mockGeneratePDF,
  mockDownloadBlob,
  mockUploadStatement,
  mockIsValidArtistId,
  mockIsValidPeriod,
} = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockGeneratePDF: vi.fn(),
  mockDownloadBlob: vi.fn(),
  mockUploadStatement: vi.fn(),
  mockIsValidArtistId: vi.fn(),
  mockIsValidPeriod: vi.fn(),
}))

vi.mock('@/contexts/DictContext', () => ({
  useDict: () => ({ admin: { accounting: {} } }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
    loading: vi.fn(),
    info: vi.fn(),
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
  isValidPeriod: mockIsValidPeriod,
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
    mockIsValidPeriod.mockReturnValue(true)
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
    mockIsValidPeriod.mockReturnValue(false)
  })

  it('uploads statement PDF to portal with fallback quarter period', async () => {
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

    expect(mockGeneratePDF).toHaveBeenCalledOnce()
    expect(mockUploadStatement).toHaveBeenCalledWith(
      expect.objectContaining({
        artistId: '123e4567-e89b-12d3-a456-426614174000',
        filename: 'Artist_One_statement.pdf',
        period: `Q1-${new Date().getFullYear()}`,
        amountEur: 123.45,
        pdfBase64: expect.any(String),
      })
    )
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Draft statement saved to portal. Approve in Settlement Center to notify the artist.',
    )
  })

  it('shows upload error and does not fall back to local download', async () => {
    mockIsValidPeriod.mockReturnValue(true)
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

    expect(mockToastError).toHaveBeenCalledWith('Portal unavailable')
    expect(mockDownloadBlob).not.toHaveBeenCalled()
  })
})
