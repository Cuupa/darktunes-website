export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { getTranslations } from 'next-intl/server'
import { AdminPageShell } from '../_components/AdminPageShell'

const AdminTourPlannerView = lazy(() =>
  import('@/components/admin/AdminTourPlannerView').then((m) => ({ default: m.AdminTourPlannerView })),
)

export default async function AdminTourPlannerPage() {
  const t = await getTranslations('admin')

  return (
    <AdminPageShell
      title={t('tour_planner_page_title')}
      description={t('tour_planner_page_desc')}
    >
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">{t('tour_planner_loading')}</div>}>
        <AdminTourPlannerView />
      </Suspense>
    </AdminPageShell>
  )
}