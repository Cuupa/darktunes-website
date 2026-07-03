import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useFileManager } from './useSosFileManager'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock('@/hooks/useLocalKV', () => ({ useKV: () => [[], vi.fn(), vi.fn(), true] as const }))
vi.mock('@/lib/i18n/accountingFallbacks', () => ({ useMergedAccountingLabels: () => ({
  fileUploadSuccess: '{filename} ok',
  filesUploadSuccess: '{count} ok',
  filesUploadFailed: '{count} failed',
  fileProcessFailed: 'failed',
  fileReplaceSuccess: 'replaced',
  fileReplaceFailed: 'replace failed',
  fileRemoved: 'removed',
  xlsxConvertWarning: 'warn',
}) }))

describe('useFileManager', () => {
  it('returns empty file list and ignores empty addFiles calls', async () => {
    const { result } = renderHook(() => useFileManager('believe'))
    expect(result.current.files).toEqual([])

    await act(async () => {
      await result.current.addFiles([])
    })

    expect(result.current.files).toEqual([])
  })
})
