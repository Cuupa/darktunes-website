import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFileManager } from './useSosFileManager'
import { uploadBronzeDistributorCsv, type BronzeUploadOutcome } from '@/lib/sos/bronzeUpload'
import { readFileWithProgress } from '@/lib/sos/readFileWithProgress'
import type { SosParseDoneStats } from '@/lib/sos/ingestProgress'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/i18n/accountingFallbacks', () => ({
  useMergedAccountingLabels: () => ({
    fileUploadSuccess: '{filename} ok',
    filesUploadSuccess: '{count} ok',
    filesUploadFailed: '{count} failed',
    fileProcessFailed: 'failed',
    fileReplaceSuccess: 'replaced',
    fileReplaceFailed: 'replace failed',
    fileRemoved: 'removed',
    xlsxConvertWarning: 'warn',
    ingestReading: 'Reading {read} of {total}',
    ingestDecoding: 'Decoding',
    ingestConverting: 'Converting',
    ingestWaitingParser: 'Queued',
    ingestArchiving: 'Archiving',
    ingestArchiveNoPeriod: 'No period',
    ingestArchiveRetryNoData: 'No data',
    ingestOperationId: 'Import {id}',
    ingestConfirmFailed: 'Confirm needs retry',
  }),
}))

vi.mock('@/lib/sos/readFileWithProgress', () => ({
  readFileWithProgress: vi.fn(async () => new TextEncoder().encode('a,b\n1,2').buffer),
}))

// Stateful in-memory KV so the file list actually changes across renders.
vi.mock('@/hooks/useLocalKV', async () => {
  const React = await import('react')
  const useKV = (_key: string, initial?: unknown) => {
    const [value, setValue] = React.useState(initial)
    return [value, setValue, () => {}, true] as const
  }
  return { useKV, useLocalKV: useKV }
})

vi.mock('@/lib/sos/bronzeUpload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sos/bronzeUpload')>()
  return { ...actual, uploadBronzeDistributorCsv: vi.fn() }
})

function stats(fileId: string): SosParseDoneStats {
  return {
    fileId,
    rowsParsed: 1,
    rowsSkipped: 0,
    uniqueArtistsCount: 1,
    emptyCurrencyRows: 0,
    skipReasons: [],
    periodStart: '2024-01',
    periodEnd: '2024-01',
  }
}

describe('useFileManager', () => {
  beforeEach(() => {
    vi.mocked(uploadBronzeDistributorCsv).mockReset()
  })

  it('recovers a Darkmerch reporting period when parser metadata is missing', async () => {
    const csv = [
      'DATE,ORDER NUMBER,BAND,NET REVENUE',
      'Q2 - Q3 2026,101,Artist A,10',
      'Q2 - Q3 2026,102,Artist B,15',
    ].join('\n')
    vi.mocked(readFileWithProgress).mockResolvedValueOnce(new TextEncoder().encode(csv).buffer)
    vi.mocked(uploadBronzeDistributorCsv).mockResolvedValue({
      ok: true, batchId: 'darkmerch-batch', r2Key: 'darkmerch-key',
    })
    const ids: string[] = []
    const { result } = renderHook(() =>
      useFileManager('darkmerch', { onFileAdded: (file) => ids.push(file.id) }),
    )
    await act(async () => {
      await result.current.addFiles([new File([csv], 'darkmerch_q2-q3.csv')])
    })
    await act(async () => {
      result.current.applyParseResult({
        ...stats(ids[0]), rowsParsed: 2, uniqueArtistsCount: 2,
        periodStart: '', periodEnd: '',
      })
    })
    await waitFor(() => {
      expect(uploadBronzeDistributorCsv).toHaveBeenCalledWith(expect.objectContaining({
        distributor: 'darkmerch',
        filename: 'darkmerch_q2-q3.csv',
        periodStart: '2026-04',
        periodEnd: '2026-09',
      }))
      expect(result.current.files[0]).toMatchObject({
        periodStart: '2026-04',
        periodEnd: '2026-09',
        bronzeBatchId: 'darkmerch-batch',
      })
    })
  })

  it('does not infer Darkmerch archive dates from a filename alone', async () => {
    const csv = 'DATE,BAND,NET REVENUE\n,Artist A,10'
    vi.mocked(readFileWithProgress).mockResolvedValueOnce(new TextEncoder().encode(csv).buffer)
    const ids: string[] = []
    const { result } = renderHook(() =>
      useFileManager('darkmerch', { onFileAdded: (file) => ids.push(file.id) }),
    )
    await act(async () => {
      await result.current.addFiles([new File([csv], 'darkmerch_Q2-Q3_2026.csv')])
    })
    await act(async () => {
      result.current.applyParseResult({ ...stats(ids[0]), periodStart: '', periodEnd: '' })
    })
    await waitFor(() => expect(result.current.fileStates[ids[0]]?.bronzeStatus).toBe('skipped'))
    expect(uploadBronzeDistributorCsv).not.toHaveBeenCalled()
  })

  it('returns empty file list and ignores empty addFiles calls', async () => {
    const { result } = renderHook(() => useFileManager('believe'))
    expect(result.current.files).toEqual([])

    await act(async () => {
      await result.current.addFiles([])
    })

    expect(result.current.files).toEqual([])
  })

  it('archives one file at a time and skips a file removed while queued', async () => {
    const ids: string[] = []
    const { result } = renderHook(() =>
      useFileManager('believe', { onFileAdded: (file) => ids.push(file.id) }),
    )

    await act(async () => {
      await result.current.addFiles([new File(['a,b\n1,2'], 'a.csv', { type: 'text/csv' })])
    })
    await act(async () => {
      await result.current.addFiles([new File(['a,b\n1,2'], 'b.csv', { type: 'text/csv' })])
    })
    expect(ids).toHaveLength(2)

    // Hold every upload open so the second file must wait in the queue.
    const resolvers: Array<(value: BronzeUploadOutcome) => void> = []
    vi.mocked(uploadBronzeDistributorCsv).mockImplementation(
      () => new Promise<BronzeUploadOutcome>((resolve) => resolvers.push(resolve)),
    )

    await act(async () => {
      result.current.applyParseResult(stats(ids[0]))
      result.current.applyParseResult(stats(ids[1]))
    })

    await waitFor(() => expect(uploadBronzeDistributorCsv).toHaveBeenCalledTimes(1))
    expect(uploadBronzeDistributorCsv).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'a.csv' }),
    )

    // Remove the queued file, then let the first archive finish.
    act(() => {
      result.current.removeFile(ids[1])
    })
    await act(async () => {
      resolvers[0]({ ok: true, batchId: 'batch-a', r2Key: 'key-a' })
    })

    await waitFor(() => expect(result.current.files).toHaveLength(1))
    expect(uploadBronzeDistributorCsv).toHaveBeenCalledTimes(1)
  })

  it('reuses the persisted operation ID when retrying one failed archive', async () => {
    const ids: string[] = []
    const { result } = renderHook(() =>
      useFileManager('believe', { onFileAdded: (file) => ids.push(file.id) }),
    )
    vi.mocked(uploadBronzeDistributorCsv)
      .mockResolvedValueOnce({ ok: false, message: 'network timeout' })
      .mockResolvedValueOnce({ ok: true, batchId: 'batch-retry', r2Key: 'key-retry' })

    await act(async () => {
      await result.current.addFiles([new File(['a,b\n1,2'], 'retry.csv', { type: 'text/csv' })])
    })
    await act(async () => {
      result.current.applyParseResult(stats(ids[0]))
    })

    await waitFor(() => expect(result.current.fileStates[ids[0]]?.bronzeStatus).toBe('error'))
    const firstOperationId = vi.mocked(uploadBronzeDistributorCsv).mock.calls[0]?.[0].operationId
    expect(firstOperationId).toMatch(/^[0-9a-f-]{36}$/i)

    await act(async () => {
      result.current.retryArchive(ids[0])
    })

    await waitFor(() => expect(result.current.fileStates[ids[0]]?.bronzeStatus).toBe('done'))
    expect(vi.mocked(uploadBronzeDistributorCsv).mock.calls[1]?.[0].operationId).toBe(
      firstOperationId,
    )
  })

  it('shows a specific confirmation error and its operation reference', async () => {
    const ids: string[] = []
    const { result } = renderHook(() =>
      useFileManager('believe', { onFileAdded: (file) => ids.push(file.id) }),
    )
    vi.mocked(uploadBronzeDistributorCsv).mockResolvedValue({
      ok: false,
      message: 'Archive confirm failed after upload',
      phase: 'confirm',
    })

    await act(async () => {
      await result.current.addFiles([new File(['a,b\n1,2'], 'confirm.csv', { type: 'text/csv' })])
    })
    await act(async () => {
      result.current.applyParseResult(stats(ids[0]))
    })

    await waitFor(() => expect(result.current.fileStates[ids[0]]?.bronzeStatus).toBe('error'))
    expect(result.current.fileStates[ids[0]]?.bronzeError).toBe('Confirm needs retry')
    expect(result.current.fileStates[ids[0]]?.operationId).toMatch(/^[0-9a-f-]{36}$/i)
  })
})
