/**
 * app/admin/videos/page.tsx — Videos Management
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../_components/AdminPageShell'

const VideosManager = lazy(() =>
  import('@/components/admin/VideosManager').then((m) => ({ default: m.VideosManager })),
)

export default function AdminVideosPage() {
  return (
    <AdminPageShell title="Videos" description="Manage YouTube videos and channel syncing.">
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <VideosManager />
      </Suspense>
    </AdminPageShell>
  )
}
