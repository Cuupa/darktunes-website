/**
 * app/admin/video-submissions/page.tsx — Video Submissions
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../_components/AdminPageShell'

const VideoSubmissionsManager = lazy(() =>
  import('@/components/admin/VideoSubmissionsManager').then((m) => ({ default: m.VideoSubmissionsManager })),
)

export default function AdminVideoSubmissionsPage() {
  return (
    <AdminPageShell title="Video Submissions" description="Review and approve video submissions from artists.">
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <VideoSubmissionsManager />
      </Suspense>
    </AdminPageShell>
  )
}
