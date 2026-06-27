export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../_components/AdminPageShell'

const AdminTourPlannerView = lazy(() =>
  import('@/components/admin/AdminTourPlannerView').then((m) => ({ default: m.AdminTourPlannerView })),
)

export default function AdminTourPlannerPage() {
  return (
    <AdminPageShell
      title="Tour Planner"
      description="Read-only overview of artist tour production data."
    >
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <AdminTourPlannerView />
      </Suspense>
    </AdminPageShell>
  )
}