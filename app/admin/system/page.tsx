/**
 * app/admin/system/page.tsx — System Health, Logs & Media
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../../_components/AdminPageShell'

const SystemHealthWidget = lazy(() =>
  import('@/components/admin/SystemHealthWidget').then((m) => ({ default: m.SystemHealthWidget })),
)
const LogsManager = lazy(() =>
  import('@/components/admin/LogsManager').then((m) => ({ default: m.LogsManager })),
)
const MediaManager = lazy(() =>
  import('@/components/admin/MediaManager').then((m) => ({ default: m.MediaManager })),
)

export default function AdminSystemPage() {
  return (
    <AdminPageShell title="System" description="Monitor system health, audit logs, and manage media files.">
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <div className="space-y-8">
          <SystemHealthWidget />
          <LogsManager />
          <MediaManager />
        </div>
      </Suspense>
    </AdminPageShell>
  )
}
