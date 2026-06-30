/**
 * app/admin/artists/page.tsx — Artists Management
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../_components/AdminPageShell'

const ArtistsManager = lazy(() =>
  import('@/components/admin/ArtistsManager').then((m) => ({ default: m.ArtistsManager })),
)

export default function AdminArtistsPage() {
  return (
    <AdminPageShell fill title="Artists" description="Manage label artists, their information, and social links.">
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <ArtistsManager />
      </Suspense>
    </AdminPageShell>
  )
}
