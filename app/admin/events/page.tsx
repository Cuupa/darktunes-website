/**
 * app/admin/events/page.tsx — Events / Live Shows Management
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../_components/AdminPageShell'

const AdminConcertsManager = lazy(() =>
  import('@/components/admin/AdminConcertsManager').then((m) => ({ default: m.AdminConcertsManager })),
)

export default function AdminEventsPage() {
  return (
    <AdminPageShell title="Events" description="Manage live shows and concert dates for all artists.">
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <AdminConcertsManager />
      </Suspense>
    </AdminPageShell>
  )
}
