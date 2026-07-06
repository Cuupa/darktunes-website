/**
 * app/admin/genres/page.tsx — Genre Catalogue Management
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../_components/AdminPageShell'

const GenresManager = lazy(() =>
  import('@/components/admin/GenresManager').then((m) => ({ default: m.GenresManager })),
)

export default function AdminGenresPage() {
  return (
    <AdminPageShell title="Genre Catalogue" description="Manage the central genre list used for artist tagging. Genres added here are available as a pick-list in all artist forms.">
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <GenresManager />
      </Suspense>
    </AdminPageShell>
  )
}
