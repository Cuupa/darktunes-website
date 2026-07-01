import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAdminNavBadges } from '@/hooks/useAdminNavBadges'

const portalMessageHandlers: Array<() => void> = []
const removeChannelMock = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'portal_messages') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                is: () => Promise.resolve({ count: 2, error: null }),
              }),
            }),
          }),
        }
      }
      if (table === 'release_submissions' || table === 'video_submissions' || table === 'artist_landing_pages') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ count: 0, error: null }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ count: 0, error: null }),
        }),
      }
    },
    channel: (name: string) => {
      const chain = {
        on: (
          _event: string,
          config: { table?: string },
          handler: () => void,
        ) => {
          if (config.table === 'portal_messages') {
            portalMessageHandlers.push(handler)
          }
          return chain
        },
        subscribe: () => chain,
      }
      void name
      return chain
    },
    removeChannel: removeChannelMock,
  }),
}))

describe('useAdminNavBadges', () => {
  beforeEach(() => {
    portalMessageHandlers.length = 0
    removeChannelMock.mockClear()
  })

  it('refreshes message count when portal_messages changes', async () => {
    const { result } = renderHook(() => useAdminNavBadges('user-1', true))

    await waitFor(() => {
      expect(result.current.messages).toBe(2)
    })

    expect(portalMessageHandlers.length).toBeGreaterThan(0)

    portalMessageHandlers[0]?.()

    await waitFor(() => {
      expect(result.current.messages).toBe(2)
    })
  })
})