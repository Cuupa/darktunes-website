'use client'

import { useCallback, useEffect, useState } from 'react'

function readOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(readOnline)

  const refresh = useCallback(() => {
    setOnline(readOnline())
  }, [])

  useEffect(() => {
    setOnline(readOnline())

    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return { online, offline: !online, refresh }
}