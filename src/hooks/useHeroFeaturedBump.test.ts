import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useHeroFeaturedBump } from './useHeroFeaturedBump'

const { updateRelease, updateNewsPost, previewFeaturedBump, HERO_BUMP_UPDATE } = vi.hoisted(() => ({
  updateRelease: vi.fn(),
  updateNewsPost: vi.fn(),
  previewFeaturedBump: vi.fn(),
  HERO_BUMP_UPDATE: { hero_featured: false },
}))

vi.mock('@/hooks/useReleases', () => ({ useReleases: () => ({ releases: [], updateRelease }) }))
vi.mock('@/hooks/useNews', () => ({ useNews: () => ({ news: [], updateNewsPost }) }))
vi.mock('@/lib/heroFeatured', () => ({
  previewFeaturedBump,
  HERO_BUMP_UPDATE,
}))

describe('useHeroFeaturedBump', () => {
  it('creates pending action and confirms bump flow', async () => {
    previewFeaturedBump.mockReturnValue({
      needsConfirm: true,
      message: 'Needs bump',
      bumpTarget: { id: 'release-2', kind: 'release' },
    })

    const action = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useHeroFeaturedBump())

    await act(async () => {
      await result.current.runWithOptionalBump({
        activatingFeatured: true,
        wasFeatured: false,
        itemId: 'release-1',
        kind: 'release',
        action,
      })
    })

    expect(result.current.pendingAction?.message).toBe('Needs bump')

    await act(async () => {
      await result.current.confirmPendingAction()
    })

    expect(updateRelease).toHaveBeenCalledWith('release-2', { hero_featured: false })
    expect(action).toHaveBeenCalledWith({ id: 'release-2', kind: 'release' })
  })
})
