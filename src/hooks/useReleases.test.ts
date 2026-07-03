import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useReleases } from './useReleases'

const { getReleases, createRelease } = vi.hoisted(() => ({
  getReleases: vi.fn(),
  createRelease: vi.fn(),
}))

vi.mock('@/env', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/api/releases', () => ({
  getReleases,
  createRelease,
  updateRelease: vi.fn(),
  deleteRelease: vi.fn(),
}))
vi.mock('@/lib/editorActivityLogger', () => ({ logEditorActivity: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  }),
}))

describe('useReleases', () => {
  it('loads releases and creates a release', async () => {
    getReleases.mockResolvedValueOnce([{ id: 'r1', title: 'R1' }]).mockResolvedValueOnce([{ id: 'r1', title: 'R1' }])
    createRelease.mockResolvedValue({ id: 'r2', title: 'R2' })

    const { result } = renderHook(() => useReleases())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.releases).toHaveLength(1)

    await act(async () => {
      await result.current.createRelease({ title: 'R2' } as never)
    })

    expect(createRelease).toHaveBeenCalled()
  })
})
