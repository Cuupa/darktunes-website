'use client'

/**
 * app/admin/_components/AdminSystemWrapper.tsx
 *
 * Client wrapper for the system admin page. Reads the session access_token
 * via useAuthContext and passes it as the required bearerToken prop to
 * SystemHealthWidget.
 */

import { Suspense, lazy } from 'react'
import { useAuthContext } from '@/contexts/AuthContext'

const SystemHealthWidget = lazy(() =>
  import('@/components/admin/SystemHealthWidget').then((m) => ({ default: m.SystemHealthWidget })),
)
const LogsManager = lazy(() =>
  import('@/components/admin/LogsManager').then((m) => ({ default: m.LogsManager })),
)
const MediaManager = lazy(() =>
  import('@/components/admin/MediaManager').then((m) => ({ default: m.MediaManager })),
)

export function AdminSystemWrapper() {
  const { session } = useAuthContext()

  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
      <div className="space-y-8">
        <SystemHealthWidget bearerToken={session?.access_token ?? ''} />
        <LogsManager />
        <MediaManager />
      </div>
    </Suspense>
  )
}
