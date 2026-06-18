'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import type { Genre } from '@/lib/api/genres'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

export function useGenres() {
  const [genres, setGenres] = useState<Genre[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchGenres = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/genres')
      if (!res.ok) throw new Error('Failed to fetch genres')
      const data = (await res.json()) as Genre[]
      setGenres(data)
    } catch {
      // graceful: empty list
      setGenres([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchGenres()
  }, [fetchGenres])

  const getToken = async () => {
    const supabase = createBrowserSupabaseClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  const addGenre = useCallback(async (name: string): Promise<Genre | null> => {
    const token = await getToken()
    if (!token) { toast.error('Not authenticated'); return null }
    const res = await fetch('/api/admin/genres', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: string } | null
      toast.error(err?.error ?? 'Failed to add genre')
      return null
    }
    const genre = (await res.json()) as Genre
    setGenres((prev) => [...prev, genre].sort((a, b) => a.name.localeCompare(b.name)))
    return genre
  }, [])

  const removeGenre = useCallback(async (id: string): Promise<boolean> => {
    const token = await getToken()
    if (!token) { toast.error('Not authenticated'); return false }
    const res = await fetch('/api/admin/genres?id=' + id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token },
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: string } | null
      toast.error(err?.error ?? 'Failed to delete genre')
      return false
    }
    setGenres((prev) => prev.filter((g) => g.id !== id))
    return true
  }, [])

  return { genres, isLoading, addGenre, removeGenre, refetch: fetchGenres }
}
