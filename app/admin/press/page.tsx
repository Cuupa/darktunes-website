/**
 * app/admin/press/page.tsx — Press Portal Management
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../_components/AdminPageShell'

const PressManager = lazy(() =>
  import('@/components/admin/PressManager').then((m) => ({ default: m.PressManager })),
)

export default function AdminPressPage() {
  return (
    <AdminPageShell title="Press Portal" description="Manage press photos, promo tracks, and EPK assets.">
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <PressManager />
      </Suspense>
    </AdminPageShell>
  )
}
