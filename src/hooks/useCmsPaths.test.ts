import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCmsPaths } from './useCmsPaths'

vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({ profile: { role: 'editor' }, loading: false }),
}))

vi.mock('@/lib/editor/cmsPaths', () => ({
  cmsAudienceFromRole: () => 'editor',
  getCmsArtistsPath: () => '/editor/artists',
  getCmsArtistEditPath: (id: string) => `/editor/artists/${id}`,
  getCmsHomePath: () => '/editor',
  getCmsNewsEditPath: (id: string) => `/editor/news/${id}`,
  getCmsNewsListPath: () => '/editor/news',
  getCmsNewsNewPath: () => '/editor/news/new',
  getCmsPromoLogPath: () => '/editor/promo-log',
  getCmsTabPath: (_audience: string, tab: string) => `/editor/${tab}`,
}))

describe('useCmsPaths', () => {
  it('returns editor-scoped cms paths', () => {
    const { result } = renderHook(() => useCmsPaths())

    expect(result.current.audience).toBe('editor')
    expect(result.current.artists).toBe('/editor/artists')
    expect(result.current.tab('news')).toBe('/editor/news')
  })
})
