import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useReleases } from './useReleases'

const { getReleases, createRelease, getSession } = vi.hoisted(() => ({
  getReleases: vi.fn(),
  createRelease: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('@/env', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/api/releases', () => ({
  getReleases,
  createRelease,
  updateRelease: vi.fn(),
  deleteRelease: vi.fn(),
}))
vi.mock('@/lib/editorActivityLogger', () => ({ logEditorActivity: vi.fn() }))
vi.mock('@/lib/admin/revalidateContentCache', () => ({
  revalidateContentCache: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/sync/waitForSyncQueue', () => ({
  waitForSyncQueueIdle: vi.fn().mockResolvedValue({
    drained: true,
    stats: { pending: 0, running: 0, done: 3, failed: 0 },
    waitedMs: 100,
  }),
}))
vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    auth: { getSession },
  }),
}))

describe('useReleases', () => {
  it('loads releases and creates a release', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 't' } } })
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

  it('syncAllReleases waits for queue and returns drain outcome', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 't' } } })
    getReleases.mockResolvedValue([])
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '{"queued":2}',
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '{"accepted":true}',
      })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useReleases())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let outcome: Awaited<ReturnType<typeof result.current.syncAllReleases>> | undefined
    await act(async () => {
      outcome = await result.current.syncAllReleases()
    })

    expect(outcome?.drained).toBe(true)
    expect(outcome?.legacyResult).toBeNull()
    vi.unstubAllGlobals()
  })
})
