import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePortalFaq } from './usePortalFaq'

vi.mock('@/env', () => ({ isSupabaseConfigured: false }))
vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({ auth: { getSession: vi.fn() } }),
}))

describe('usePortalFaq', () => {
  it('stays empty when supabase is disabled and supports reload call', async () => {
    const { result } = renderHook(() => usePortalFaq())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.tree).toEqual([])
    })

    await act(async () => {
      await result.current.reload()
    })

    expect(result.current.categories).toEqual([])
  })
})
