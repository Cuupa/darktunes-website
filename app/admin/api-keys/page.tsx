/**
 * app/admin/api-keys/page.tsx — External integration credentials (admin-only)
 */

export const dynamic = 'force-dynamic'

import { getTranslations } from 'next-intl/server'
import { AdminPageShell } from '../_components/AdminPageShell'
import { AdminApiKeysWrapper } from '../_components/AdminApiKeysWrapper'

export default async function AdminApiKeysPage() {
  const t = await getTranslations('admin.apiKeys')

  return (
    <AdminPageShell title={t('pageTitle')} description={t('pageDescription')}>
      <AdminApiKeysWrapper />
    </AdminPageShell>
  )
}