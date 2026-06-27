'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { flushSyncQueue, getLastSyncedAt, getPendingMutationCount } from '@/lib/tour-planner/offline/syncQueue'

export function useTourPlannerOffline() {
  const queryClient = useQueryClient()
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const refresh = useCallback(async () => {
    setPending(await getPendingMutationCount())
    setLastSynced(await getLastSyncedAt())
  }, [])

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return
    setSyncing(true)
    try {
      const result = await flushSyncQueue()
      if (result.flushed > 0) {
        await queryClient.invalidateQueries({ queryKey: ['tour-planner'] })
      }
    } finally {
      await refresh()
      setSyncing(false)
    }
  }, [queryClient, refresh])

  useEffect(() => {
    setOnline(navigator.onLine)
    void refresh()

    const onOnline = () => {
      setOnline(true)
      void syncNow()
    }
    const onOffline = () => setOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [refresh, syncNow])

  return { online, pending, lastSynced, syncing, syncNow, refresh }
}