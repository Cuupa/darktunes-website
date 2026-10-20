import { getTranslations } from 'next-intl/server'
import { AdminPageShell } from '../_components/AdminPageShell'
import { requirePageCapability } from '@/lib/rbac/requireAdminPage'

export default async function AdminAiPage() {
  await requirePageCapability('admin.panel.full')
  const t = await getTranslations('ai')
  return (
    <AdminPageShell title={t('title')} description={t('empty')}>
      <p className="text-sm text-muted-foreground">{t('notConfigured')}</p>
    </AdminPageShell>
  )
}
