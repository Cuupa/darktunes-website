import { getTranslations } from 'next-intl/server'
import { AdminPageShell } from '../_components/AdminPageShell'
import { requirePageCapability } from '@/lib/rbac/requireAdminPage'
import { AdminAiDashboard } from './_components/AdminAiDashboard'

export default async function AdminAiPage() {
  await requirePageCapability('admin.panel.full')
  const t = await getTranslations('ai')
  return (
    <AdminPageShell title={t('title')} description={t('pageDescription')}>
      <AdminAiDashboard />
    </AdminPageShell>
  )
}
