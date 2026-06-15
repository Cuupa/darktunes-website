/**
 * app/admin/assets/page.tsx — Assets / File Explorer
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../_components/AdminPageShell'

const AssetsManager = lazy(() =>
  import('@/components/admin/AssetsManager').then((m) => ({ default: m.AssetsManager })),
)

export default function AdminAssetsPage() {
  return (
    <AdminPageShell title="Assets" description="Browse, upload, and manage media files in Cloudflare R2.">
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <AssetsManager />
      </Suspense>
    </AdminPageShell>
  )
}
