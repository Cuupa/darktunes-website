import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useRolePermissions } from './useRolePermissions'

vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({
    loading: false,
    profile: { role: 'editor' },
  }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { role: 'editor', can_manage_news: true }, error: null }),
        }),
      }),
    }),
  }),
}))

describe('useRolePermissions', () => {
  it('loads role permissions for non-admin users', async () => {
    const { result } = renderHook(() => useRolePermissions())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.permissions?.role).toBe('editor')
    })

    expect(result.current.hasFullAccess).toBe(false)
  })
})
