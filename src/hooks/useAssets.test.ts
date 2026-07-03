import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAssets } from './useAssets'

const { getAssets, createAssetRecord, deleteAssetRecord } = vi.hoisted(() => ({
  getAssets: vi.fn(),
  createAssetRecord: vi.fn(),
  deleteAssetRecord: vi.fn(),
}))

vi.mock('@/env', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/api/assets', () => ({ getAssets, createAssetRecord, deleteAssetRecord }))
vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({ auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } }),
}))

describe('useAssets', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads assets and supports deletion with reload', async () => {
    getAssets.mockResolvedValueOnce([{ id: 'a1' }]).mockResolvedValueOnce([])

    const { result } = renderHook(() => useAssets())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.assets).toHaveLength(1)
    })

    await act(async () => {
      await result.current.deleteAssetRecord('a1')
    })

    expect(deleteAssetRecord).toHaveBeenCalledWith(expect.any(Object), 'a1')
    expect(getAssets).toHaveBeenCalledTimes(2)
  })

  it('captures load errors', async () => {
    getAssets.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useAssets())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.message).toBe('boom')
  })
})
