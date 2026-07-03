import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useFileExplorer } from './useFileExplorer'

vi.mock('@/env', () => ({ isSupabaseConfigured: false }))
vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({ auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } }),
}))

describe('useFileExplorer', () => {
  it('initializes empty state when supabase is disabled and navigates folders', async () => {
    const { result } = renderHook(() => useFileExplorer(null))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.assets).toEqual([])
    })

    act(() => {
      result.current.navigateTo('folder-1')
    })

    expect(result.current.currentFolderId).toBe('folder-1')
  })
})
