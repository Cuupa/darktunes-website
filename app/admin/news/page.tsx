/**
 * app/admin/news/page.tsx — News Management
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../_components/AdminPageShell'

const NewsManager = lazy(() =>
  import('@/components/admin/NewsManager').then((m) => ({ default: m.NewsManager })),
)

export default function AdminNewsPage() {
  return (
    <AdminPageShell title="News" description="Create and manage news posts and announcements.">
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <NewsManager />
      </Suspense>
    </AdminPageShell>
  )
}
