'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useOnlineStatus } from '@/lib/offline/useOnlineStatus'
import { isPortalOfflineRoute } from '@/lib/offline/portalRoutes'

interface PortalOfflineContextValue {
  online: boolean
  offline: boolean
  canNavigateTo: (pathname: string) => boolean
}

const PortalOfflineContext = createContext<PortalOfflineContextValue>({
  online: true,
  offline: false,
  canNavigateTo: () => true,
})

export function PortalOfflineProvider({ children }: { children: ReactNode }) {
  const { online, offline } = useOnlineStatus()

  const canNavigateTo = (pathname: string) => online || isPortalOfflineRoute(pathname)

  return (
    <PortalOfflineContext.Provider value={{ online, offline, canNavigateTo }}>
      {children}
    </PortalOfflineContext.Provider>
  )
}

export function usePortalOffline() {
  return useContext(PortalOfflineContext)
}