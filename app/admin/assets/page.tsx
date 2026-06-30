/**
 * app/admin/assets/page.tsx — Assets / File Explorer
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { getTranslations } from 'next-intl/server'
import { AdminPageShell } from '../_components/AdminPageShell'

const AssetsManager = lazy(() =>
  import('@/components/admin/AssetsManager').then((m) => ({ default: m.AssetsManager })),
)

export default async function AdminAssetsPage() {
  const t = await getTranslations('admin.pages')

  return (
    <AdminPageShell fill title="Assets" description={t('assetsDescription')}>
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <AssetsManager />
      </Suspense>
    </AdminPageShell>
  )
}
