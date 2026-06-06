'use client'

/**
 * app/admin/_components/AdminSystemWrapper.tsx
 *
 * Client wrapper for the system admin page. Renders all system components
 * within a single top-level Tabs to avoid multiple visible tab rows.
 */

import { Suspense, lazy } from 'react'
import { useAuthContext } from '@/contexts/AuthContext'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
      <Tabs defaultValue="health" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="health">Health &amp; Logs</TabsTrigger>
          <TabsTrigger value="logs">Log Manager</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
        </TabsList>
        <TabsContent value="health">
          <SystemHealthWidget bearerToken={session?.access_token ?? ''} />
        </TabsContent>
        <TabsContent value="logs">
          <LogsManager />
        </TabsContent>
        <TabsContent value="media">
          <MediaManager />
        </TabsContent>
      </Tabs>
    </Suspense>
  )
}
