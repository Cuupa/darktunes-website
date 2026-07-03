import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAuth } from './useAuth'

const { signInWithPassword, signUp, signOut, signInWithOAuth } = vi.hoisted(() => ({
  signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
  signUp: vi.fn().mockResolvedValue({ error: null }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
  signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword,
      signUp,
      signOut,
      signInWithOAuth,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: new Error('no profile') }),
        }),
      }),
    }),
  }),
}))

describe('useAuth', () => {
  it('starts unauthenticated and calls signIn action', async () => {
    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.isAuthenticated).toBe(false)
    })

    await act(async () => {
      await result.current.signIn('test@example.com', 'secret')
    })

    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'test@example.com', password: 'secret' })
  })
})
