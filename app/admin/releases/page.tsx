/**
 * app/admin/releases/page.tsx — Releases Management
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../_components/AdminPageShell'

const ReleasesManager = lazy(() =>
  import('@/components/admin/ReleasesManager').then((m) => ({ default: m.ReleasesManager })),
)

export default function AdminReleasesPage() {
  return (
    <AdminPageShell title="Releases" description="Manage music releases, albums, EPs, and singles.">
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <ReleasesManager />
      </Suspense>
    </AdminPageShell>
  )
}
