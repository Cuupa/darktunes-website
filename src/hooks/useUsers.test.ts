import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUsers } from './useUsers'

const { toastError, toastSuccess } = vi.hoisted(() => ({ toastError: vi.fn(), toastSuccess: vi.fn() }))

vi.mock('sonner', () => ({ toast: { error: toastError, success: toastSuccess } }))
vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } } }) },
  }),
}))

describe('useUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads users and updates role', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ users: [{ id: 'u1', role: 'user' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ users: [{ id: 'u1', role: 'editor' }] }) }))

    const { result } = renderHook(() => useUsers())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.users[0]?.id).toBe('u1')

    await act(async () => {
      await result.current.updateRole('u1', 'editor')
    })

    expect(toastSuccess).toHaveBeenCalledWith('Role updated')
  })
})
