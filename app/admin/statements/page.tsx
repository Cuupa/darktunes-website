/**
 * app/admin/statements/page.tsx — Sales Statements
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../_components/AdminPageShell'

const StatementsManager = lazy(() =>
  import('@/components/admin/StatementsManager').then((m) => ({ default: m.StatementsManager })),
)

export default function AdminStatementsPage() {
  return (
    <AdminPageShell title="Statements" description="View and manage royalty sales statements for all artists.">
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <StatementsManager />
      </Suspense>
    </AdminPageShell>
  )
}
