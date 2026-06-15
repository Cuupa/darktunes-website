/**
 * app/admin/release-submissions/page.tsx — Release Submissions
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../_components/AdminPageShell'

const ReleaseSubmissionsManager = lazy(() =>
  import('@/components/admin/ReleaseSubmissionsManager').then((m) => ({ default: m.ReleaseSubmissionsManager })),
)

export default function AdminReleaseSubmissionsPage() {
  return (
    <AdminPageShell title="Release Submissions" description="Review and approve release submissions from artists.">
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <ReleaseSubmissionsManager />
      </Suspense>
    </AdminPageShell>
  )
}
