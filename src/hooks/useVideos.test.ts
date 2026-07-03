import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useVideos } from './useVideos'

const { getVideos, updateVideo } = vi.hoisted(() => ({
  getVideos: vi.fn(),
  updateVideo: vi.fn(),
}))

vi.mock('@/env', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/api/videos', () => ({
  getVideos,
  createVideo: vi.fn(),
  updateVideo,
  deleteVideo: vi.fn(),
}))
vi.mock('@/lib/editorActivityLogger', () => ({ logEditorActivity: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  }),
}))

describe('useVideos', () => {
  it('loads videos and applies optimistic update call', async () => {
    getVideos.mockResolvedValueOnce([{ id: 'v1', title: 'V1' }])
    updateVideo.mockResolvedValue({ id: 'v1', title: 'V1+', is_visible: true })

    const { result } = renderHook(() => useVideos())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.updateVideo('v1', { title: 'V1+' } as never)
    })

    expect(updateVideo).toHaveBeenCalledWith(expect.any(Object), 'v1', { title: 'V1+' })
  })
})
