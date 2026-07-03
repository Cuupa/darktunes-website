import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useGenres } from './useGenres'

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: toastError } }))
vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  }),
}))

describe('useGenres', () => {
  it('loads genres and returns null on unauthenticated add', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: 'g1', name: 'Metal' }] }))

    const { result } = renderHook(() => useGenres())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.genres).toHaveLength(1)

    await act(async () => {
      const added = await result.current.addGenre('Rock')
      expect(added).toBeNull()
    })

    expect(toastError).toHaveBeenCalledWith('Not authenticated')
  })
})
