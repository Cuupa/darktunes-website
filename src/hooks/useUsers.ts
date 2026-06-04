/**
 * src/hooks/useUsers.ts
 *
 * Admin hook for user management.
 * Loads the user list via GET /api/admin/users and exposes mutation helpers
 * that call the corresponding admin API endpoints.
 *
 * Optimistic updates are applied immediately; the server response re-syncs
 * the list to prevent stale state.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { UserWithProfile, UserRole } from '@/types/users'

export function useUsers() {
  const [users, setUsers] = useState<UserWithProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  // ---------------------------------------------------------------------------
  // Shared helper: attach Bearer token to requests
  // ---------------------------------------------------------------------------

  const getToken = useCallback(async (): Promise<string> => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Not authenticated')
    return session.access_token
  }, [supabase])

  const authHeaders = useCallback(
    async (): Promise<HeadersInit> => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await getToken()}`,
    }),
    [getToken],
  )

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const headers = await authHeaders()
      const res = await fetch('/api/admin/users', { headers })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? 'Failed to load users')
      }
      const data = (await res.json()) as { users: UserWithProfile[] }
      setUsers(data.users)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    void load()
  }, [load])

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const updateRole = useCallback(
    async (userId: string, role: UserRole): Promise<void> => {
      // Optimistic update
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
      try {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: 'PATCH',
          headers: await authHeaders(),
          body: JSON.stringify({ role }),
        })
        if (!res.ok) {
          const err = (await res.json()) as { error?: string }
          throw new Error(err.error ?? 'Failed to update role')
        }
        toast.success('Role updated')
        await load()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update role')
        await load() // Revert optimistic update
      }
    },
    [authHeaders, load],
  )

  const toggleBan = useCallback(
    async (userId: string, ban: boolean, reason?: string): Promise<void> => {
      try {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: 'PATCH',
          headers: await authHeaders(),
          body: JSON.stringify({ ban, ...(reason ? { reason } : {}) }),
        })
        if (!res.ok) {
          const err = (await res.json()) as { error?: string }
          throw new Error(err.error ?? 'Failed to update ban status')
        }
        toast.success(ban ? 'User banned' : 'User unbanned')
        await load()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update ban status')
      }
    },
    [authHeaders, load],
  )

  const deleteUser = useCallback(
    async (userId: string): Promise<void> => {
      try {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: 'DELETE',
          headers: await authHeaders(),
        })
        if (!res.ok) {
          const err = (await res.json()) as { error?: string }
          throw new Error(err.error ?? 'Failed to delete user')
        }
        setUsers((prev) => prev.filter((u) => u.id !== userId))
        toast.success('User deleted')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete user')
      }
    },
    [authHeaders],
  )

  const linkArtist = useCallback(
    async (userId: string, artistId: string): Promise<void> => {
      try {
        const res = await fetch(`/api/admin/users/${userId}/link-artist`, {
          method: 'PATCH',
          headers: await authHeaders(),
          body: JSON.stringify({ artistId }),
        })
        if (!res.ok) {
          const err = (await res.json()) as { error?: string }
          throw new Error(err.error ?? 'Failed to link artist')
        }
        toast.success('Artist linked')
        await load()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to link artist')
      }
    },
    [authHeaders, load],
  )

  const unlinkArtist = useCallback(
    async (userId: string): Promise<void> => {
      try {
        const res = await fetch(`/api/admin/users/${userId}/link-artist`, {
          method: 'PATCH',
          headers: await authHeaders(),
          body: JSON.stringify({ artistId: null }),
        })
        if (!res.ok) {
          const err = (await res.json()) as { error?: string }
          throw new Error(err.error ?? 'Failed to unlink artist')
        }
        toast.success('Artist unlinked')
        await load()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to unlink artist')
      }
    },
    [authHeaders, load],
  )

  return {
    users,
    isLoading,
    reload: load,
    updateRole,
    toggleBan,
    deleteUser,
    linkArtist,
    unlinkArtist,
  }
}
