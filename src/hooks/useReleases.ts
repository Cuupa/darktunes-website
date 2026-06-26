import { useState, useEffect, useCallback, useMemo } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/env'
import * as releasesApi from '@/lib/api/releases'
import { logEditorActivity } from '@/lib/editorActivityLogger'
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
    const created = await releasesApi.createRelease(supabase, data)
    await logEditorActivity(supabase, {
      action: 'create',
      entityType: 'release',
      entityId: created.id,
      entityName: created.title,
      changes: data,
    })
    await load()
    void revalidateContentCache(['releases'])
  }

  const updateRelease = async (id: string, data: ReleaseUpdate): Promise<void> => {
    const updated = await releasesApi.updateRelease(supabase, id, data)
    await logEditorActivity(supabase, {
      action: 'update',
      entityType: 'release',
      entityId: id,
      entityName: updated.title,
      changes: data,
    })
    await load()
    void revalidateContentCache(['releases'])
  }

  const deleteRelease = async (id: string): Promise<void> => {
    const target = releases.find((release) => release.id === id)
    await releasesApi.deleteRelease(supabase, id)
    await logEditorActivity(supabase, {
      action: 'delete',
      entityType: 'release',
      entityId: id,
      entityName: target?.title,
    })
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

      const resQueue = await fetch('/api/sync/queue', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const queueText = await resQueue.text()
      if (!resQueue.ok) {
        throw new Error(`Queue failed: ${queueText.slice(0, 200) || resQueue.status}`)
      }

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const syncText = await res.text()
      if (!res.ok) {
        throw new Error(`Sync failed: ${syncText.slice(0, 200) || res.status}`)
      }
      let raw: Record<string, unknown> = {}
      if (syncText.trim()) {
        try {
          raw = JSON.parse(syncText) as Record<string, unknown>
        } catch {
          return null
        }
      }
      // Async queue executor: { accepted: true } — results arrive via background jobs.
      if ('accepted' in raw || 'queued' in raw) return null
      // Legacy direct-result format: { results, totalErrors, … }
      if (!Array.isArray(raw.results)) return null
      return raw as unknown as SyncAllResult
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
