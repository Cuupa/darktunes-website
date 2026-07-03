import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useNews } from './useNews'

const { getNewsPosts, updateNewsPost } = vi.hoisted(() => ({
  getNewsPosts: vi.fn(),
  updateNewsPost: vi.fn(),
}))

vi.mock('@/env', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/api/news', () => ({
  getNewsPosts,
  createNewsPost: vi.fn(),
  updateNewsPost,
  deleteNewsPost: vi.fn(),
}))
vi.mock('@/lib/editorActivityLogger', () => ({ logEditorActivity: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'editor-1' } } }),
    },
  }),
}))

describe('useNews', () => {
  it('loads news and updates post', async () => {
    getNewsPosts.mockResolvedValueOnce([{ id: 'n1', title: 'N1' }]).mockResolvedValueOnce([{ id: 'n1', title: 'N1' }])
    updateNewsPost.mockResolvedValue({ id: 'n1', title: 'N1', slug: 'n1' })

    const { result } = renderHook(() => useNews())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.news).toHaveLength(1)
    })

    await act(async () => {
      await result.current.updateNewsPost('n1', { status: 'published' } as never)
    })

    expect(updateNewsPost).toHaveBeenCalled()
  })
})
