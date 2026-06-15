import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useExports } from './useSosExports'
import type { LabelArtist, LabelInfo, SafeProcessedArtistData } from '@/lib/sos/types'

const {
  mockToastSuccess,
  mockToastError,
  mockGeneratePDF,
  mockDownloadBlob,
  mockUploadStatementPdf,
  mockIsValidArtistId,
  mockIsValidPeriod,
} = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockGeneratePDF: vi.fn(),
  mockDownloadBlob: vi.fn(),
  mockUploadStatementPdf: vi.fn(),
  mockIsValidArtistId: vi.fn(),
  mockIsValidPeriod: vi.fn(),
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

vi.mock('@/lib/sos/sosWebhook', () => ({
  uploadStatementPdf: mockUploadStatementPdf,
  isValidArtistId: mockIsValidArtistId,
  isValidPeriod: mockIsValidPeriod,
}))

const labelInfo: LabelInfo = { name: 'darkTunes', address: '', invoiceNumberPrefix: 'SOS' }

function makeProcessedArtist(artist: string): SafeProcessedArtistData {
  return {
    artist,
    finalPayout: 123.45,
  } as SafeProcessedArtistData
}

describe('useSosExports.handlePublishToPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGeneratePDF.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }))
    mockIsValidArtistId.mockReturnValue(true)
    mockIsValidPeriod.mockReturnValue(false)
  })

  it('uploads statement PDF to portal with fallback quarter period', async () => {
    mockUploadStatementPdf.mockResolvedValue({ success: true })

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
        [],
        'https://example.com/api/webhooks/sos',
        'secret'
      )
    )

    await act(async () => {
      await result.current.handlePublishToPortal('Artist One')
    })

    expect(mockGeneratePDF).toHaveBeenCalledOnce()
    expect(mockUploadStatementPdf).toHaveBeenCalledWith(
      {
        artistId: '123e4567-e89b-12d3-a456-426614174000',
        filename: 'Artist_One_statement.pdf',
        period: `Q1-${new Date().getFullYear()}`,
        amountEur: 123.45,
      },
      expect.any(Blob),
      'https://example.com/api/webhooks/sos',
      'secret'
    )
    expect(mockToastSuccess).toHaveBeenCalledWith('Statement published to portal')
  })

  it('shows upload error and does not fall back to local download', async () => {
    mockIsValidPeriod.mockReturnValue(true)
    mockUploadStatementPdf.mockResolvedValue({ success: false, error: 'Portal unavailable' })

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
        'https://example.com/api/webhooks/sos',
        'secret'
      )
    )

    await act(async () => {
      await result.current.handlePublishToPortal('Artist One')
    })

    expect(mockToastError).toHaveBeenCalledWith('Portal unavailable')
    expect(mockDownloadBlob).not.toHaveBeenCalled()
  })
})
