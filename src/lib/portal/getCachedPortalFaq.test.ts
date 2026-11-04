import { beforeEach, describe, expect, it, vi } from 'vitest'

const recorded = vi.hoisted(() => ({ callback: undefined as undefined | (() => Promise<unknown>) }))

vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => Promise<unknown>) => {
    recorded.callback = fn
    return fn
  },
}))
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  cache: <T,>(fn: T) => fn,
}))
vi.mock('@/lib/supabase/publicClient', () => ({ createPublicSupabaseClient: () => ({}) }))
vi.mock('@/lib/observability/logger', () => ({ logError: vi.fn() }))
vi.mock('@/lib/api/portalFaq', () => ({ getPublishedPortalFaq: vi.fn() }))

import { logError } from '@/lib/observability/logger'
import { getPublishedPortalFaq } from '@/lib/api/portalFaq'
import { getCachedPortalFaq } from './getCachedPortalFaq'

beforeEach(() => vi.clearAllMocks())

describe('getCachedPortalFaq', () => {
  it('cache callback rejects; helper returns [] and logs', async () => {
    const boom = new Error('429')
    vi.mocked(getPublishedPortalFaq).mockRejectedValue(boom)
    await expect(recorded.callback!()).rejects.toBe(boom)
    await expect(getCachedPortalFaq()).resolves.toEqual([])
    expect(logError).toHaveBeenCalledWith('public_cache.read_failed', boom, { key: 'portal-faq-published' })
  })

  it('returns data on success', async () => {
    const tree = [{ id: 'c' }] as never
    vi.mocked(getPublishedPortalFaq).mockResolvedValue(tree)
    await expect(getCachedPortalFaq()).resolves.toBe(tree)
  })
})
