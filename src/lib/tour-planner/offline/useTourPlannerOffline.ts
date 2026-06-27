'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { tourPlannerKeys } from '@/lib/tour-planner/keys'
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

  const syncNowRef = useRef<() => Promise<void>>(async () => {})

  syncNowRef.current = async () => {
    if (!navigator.onLine) return
    setSyncing(true)
    try {
      const result = await flushSyncQueue()
      if (result.flushed > 0) {
        await queryClient.invalidateQueries({ queryKey: tourPlannerKeys.all })
      }
    } finally {
      await refresh()
      setSyncing(false)
    }
  }

  const syncNow = useCallback(() => syncNowRef.current(), [])

  useEffect(() => {
    setOnline(navigator.onLine)
    void refresh()

    const onOnline = () => {
      setOnline(true)
      void syncNowRef.current()
    }
    const onOffline = () => setOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [refresh])

  return { online, pending, lastSynced, syncing, syncNow, refresh }
}