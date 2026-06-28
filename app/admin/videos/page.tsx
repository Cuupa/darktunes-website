/**
 * app/admin/videos/page.tsx — Videos Management
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { getTranslations } from 'next-intl/server'
import { AdminPageShell } from '../_components/AdminPageShell'

const VideosManager = lazy(() =>
  import('@/components/admin/VideosManager').then((m) => ({ default: m.VideosManager })),
)

export default async function AdminVideosPage() {
  const t = await getTranslations('admin.pages')

  return (
    <AdminPageShell title="Videos" description={t('videosDescription')}>
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <VideosManager />
      </Suspense>
    </AdminPageShell>
  )
}
