import { useState, useEffect, useCallback, useMemo } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/env'
import * as releasesApi from '@/lib/api/releases'
import type { Release } from '@/types'
import type { Database } from '@/types/database'
import type { SyncAllResult } from '@/lib/sync/syncAll'

type ReleaseInsert = Database['public']['Tables']['releases']['Insert']
type ReleaseUpdate = Database['public']['Tables']['releases']['Update']

export function useReleases() {
  const [releases, setReleases] = useState<Release[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [error, setError] = useState<Error | null>(null)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const data = await releasesApi.getReleases(supabase)
      setReleases(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      setReleases([])
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  const createRelease = async (data: ReleaseInsert): Promise<void> => {
    await releasesApi.createRelease(supabase, data)
    await load()
    void revalidateContentCache(['releases'])
  }

  const updateRelease = async (id: string, data: ReleaseUpdate): Promise<void> => {
    await releasesApi.updateRelease(supabase, id, data)
    await load()
    void revalidateContentCache(['releases'])
  }

  const deleteRelease = async (id: string): Promise<void> => {
    await releasesApi.deleteRelease(supabase, id)
    await load()
    void revalidateContentCache(['releases'])
  }

  const syncAllReleases = async (): Promise<SyncAllResult | null> => {
    if (!isSupabaseConfigured) return null
    setIsSyncing(true)
    setSyncProgress(0)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Sync failed: ${text}`)
      }
      const result = (await res.json()) as SyncAllResult
      return result
    } finally {
      setIsSyncing(false)
      setSyncProgress(0)
      await load()
    }
  }

  // Fire-and-forget ISR cache revalidation after mutations
  const revalidateContentCache = async (tags: string[]): Promise<void> => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) return
      void fetch('/api/revalidate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tags }),
      })
    } catch {
      // Ignore revalidation errors — they are non-critical
    }
  }

  useEffect(() => {
    void load()
  }, [load])

  return {
    releases,
    isLoading,
    isSyncing,
    syncProgress,
    error,
    createRelease,
    updateRelease,
    deleteRelease,
    syncAllReleases,
    reload: load,
  }
}
