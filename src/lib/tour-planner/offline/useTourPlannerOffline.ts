'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useOnlineStatus } from '@/lib/offline/useOnlineStatus'
import { useQueryClient } from '@tanstack/react-query'
import { tourPlannerKeys } from '@/lib/tour-planner/keys'
import {
  clearSyncConflictCount,
  flushSyncQueue,
  getLastSyncedAt,
  getPendingMutationCount,
  getSyncConflictCount,
} from '@/lib/tour-planner/offline/syncQueue'

export function useTourPlannerOffline() {
  const queryClient = useQueryClient()
  const { online } = useOnlineStatus()
  const [pending, setPending] = useState(0)
  const [conflicts, setConflicts] = useState(0)
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const refresh = useCallback(async () => {
    setPending(await getPendingMutationCount())
    setConflicts(await getSyncConflictCount())
    setLastSynced(await getLastSyncedAt())
  }, [])

  const syncNowRef = useRef<() => Promise<void>>(async () => {})

  syncNowRef.current = async () => {
    if (!navigator.onLine) return
    setSyncing(true)
    try {
      const result = await flushSyncQueue()
      if (result.flushed > 0 || result.conflicts > 0) {
        await queryClient.invalidateQueries({ queryKey: tourPlannerKeys.all })
      }
    } finally {
      await refresh()
      setSyncing(false)
    }
  }

  const syncNow = useCallback(() => syncNowRef.current(), [])

  const dismissConflicts = useCallback(async () => {
    await clearSyncConflictCount()
    await refresh()
  }, [refresh])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!online) return
    void syncNowRef.current()
  }, [online])

  return { online, pending, conflicts, lastSynced, syncing, syncNow, dismissConflicts, refresh }
}