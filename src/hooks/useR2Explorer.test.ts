import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useR2Explorer } from './useR2Explorer'

const getSession = vi.fn()
vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({ auth: { getSession } }),
}))

const fetchMock = vi.fn()
globalThis.fetch = fetchMock

describe('useR2Explorer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({
      data: { session: { access_token: 'token-1' } },
    })
  })

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useR2Explorer())
    expect(result.current.objects).toEqual([])
    expect(result.current.prefixes).toEqual([])
    expect(result.current.currentPrefix).toBeNull()
    expect(result.current.selectedKeys.size).toBe(0)
  })

  it('navigateToPrefix fetches objects and prefixes', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ objects: [], nextCursor: null, truncated: false, search: null }),
      ),
    )
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ prefixes: [], parent: null })),
    )

    const { result } = renderHook(() => useR2Explorer())
    act(() => {
      result.current.navigateToPrefix('uploads/')
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    const calls = fetchMock.mock.calls.map((c) => c[0].toString())
    expect(calls.some((url) => url.includes('/api/admin/assets/r2?prefix=uploads%2F'))).toBe(
      true,
    )
    expect(calls.some((url) => url.includes('/api/admin/assets/r2/prefixes?parent=uploads%2F'))).toBe(
      true,
    )
    expect(result.current.currentPrefix).toBe('uploads/')
  })

  it('toggleSelect and selectAll track keys', () => {
    const { result } = renderHook(() => useR2Explorer())
    // seed objects via state is not exposed; toggleSelect works on keys directly
    act(() => {
      result.current.toggleSelect('key-a')
      result.current.toggleSelect('key-b')
    })
    expect(result.current.selectedKeys.has('key-a')).toBe(true)
    expect(result.current.selectedKeys.has('key-b')).toBe(true)
    act(() => {
      result.current.toggleSelect('key-a')
    })
    expect(result.current.selectedKeys.has('key-a')).toBe(false)
    act(() => {
      result.current.selectAll()
    })
    expect(result.current.selectedKeys.size).toBe(0)
    act(() => {
      result.current.clearSelection()
    })
    expect(result.current.selectedKeys.size).toBe(0)
  })

  it('deleteSelected calls DELETE batch and refreshes', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ deleted: 2, failed: 0 })))
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ objects: [], nextCursor: null, truncated: false, search: null }),
      ),
    )
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ prefixes: [], parent: null })))

    const { result } = renderHook(() => useR2Explorer())
    act(() => {
      result.current.toggleSelect('key-a')
      result.current.toggleSelect('key-b')
    })
    act(() => {
      result.current.deleteSelected()
    })

    await waitFor(() => {
    const deleteCall = fetchMock.mock.calls.find(
      (c) => c[0].toString().includes('/api/admin/assets/r2/batch'),
    )
    expect(deleteCall).toBeDefined()
    expect(deleteCall![1].method).toBe('DELETE')
    })
  })
})
