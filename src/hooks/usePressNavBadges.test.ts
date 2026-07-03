import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePressNavBadges } from './usePressNavBadges'

const { safeCount, removeChannel } = vi.hoisted(() => ({
  safeCount: vi.fn(),
  removeChannel: vi.fn(),
}))

vi.mock('@/lib/api/safeCount', () => ({ safeCount }))

vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({}) }) }) }),
    channel: () => ({ on: () => ({ on: () => ({ subscribe: () => ({}) }) }) }),
    removeChannel,
  }),
}))

describe('usePressNavBadges', () => {
  it('returns empty badges without user id', () => {
    const { result } = renderHook(() => usePressNavBadges(null))
    expect(result.current).toEqual({ interviews: 0, accreditation: 0 })
  })

  it('loads counts for journalist user', async () => {
    safeCount.mockResolvedValueOnce(4).mockResolvedValueOnce(2)

    const { result } = renderHook(() => usePressNavBadges('journalist-1'))

    await waitFor(() => {
      expect(result.current.interviews).toBe(4)
      expect(result.current.accreditation).toBe(2)
    })
  })
})
