/**
 * app/admin/accreditations/page.tsx — Journalist Accreditations
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../_components/AdminPageShell'

const AccreditationsManager = lazy(() =>
  import('@/components/admin/AccreditationsManager').then((m) => ({ default: m.AccreditationsManager })),
)

export default function AdminAccreditationsPage() {
  return (
    <AdminPageShell title="Press Accreditations" description="Review and manage journalist accreditation requests.">
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <AccreditationsManager />
      </Suspense>
    </AdminPageShell>
  )
}
