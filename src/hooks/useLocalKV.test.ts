import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocalKV } from './useLocalKV'

const { mockGet, mockSet, mockDel } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockDel: vi.fn(),
}))

vi.mock('idb-keyval', () => ({
  get: mockGet,
  set: mockSet,
  del: mockDel,
}))

describe('useLocalKV', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDel.mockResolvedValue(undefined)
  })

  it('loads persisted value and supports delete', async () => {
    mockGet.mockResolvedValueOnce('persisted')

    const { result } = renderHook(() => useLocalKV<string>('kv-hook-key', 'initial'))

    await waitFor(() => {
      expect(result.current[3]).toBe(true)
    })

    expect(result.current[0]).toBe('persisted')

    act(() => {
      result.current[2]()
    })

    expect(mockDel).toHaveBeenCalledWith('kv-hook-key')
  })
})
