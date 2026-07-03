import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useArtists } from './useArtists'

const { getArtists, createArtist } = vi.hoisted(() => ({
  getArtists: vi.fn(),
  createArtist: vi.fn(),
}))
const { logEditorActivity } = vi.hoisted(() => ({ logEditorActivity: vi.fn() }))

vi.mock('@/env', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/api/artists', () => ({
  getArtists,
  createArtist,
  updateArtist: vi.fn(),
  deleteArtist: vi.fn(),
}))
vi.mock('@/lib/editorActivityLogger', () => ({ logEditorActivity }))
vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  }),
}))

describe('useArtists', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads artists and creates artist with reload', async () => {
    getArtists.mockResolvedValueOnce([{ id: 'artist-1', name: 'Artist 1' }]).mockResolvedValueOnce([{ id: 'artist-1', name: 'Artist 1' }])
    createArtist.mockResolvedValueOnce({ id: 'artist-2', name: 'Artist 2' })

    const { result } = renderHook(() => useArtists())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.artists[0]?.id).toBe('artist-1')

    await act(async () => {
      await result.current.createArtist({ name: 'Artist 2' } as never)
    })

    expect(createArtist).toHaveBeenCalled()
    expect(logEditorActivity).toHaveBeenCalled()
  })
})
