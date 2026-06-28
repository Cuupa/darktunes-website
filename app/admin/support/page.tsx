/**
 * app/admin/support/page.tsx — Manual support tickets
 */

export const dynamic = 'force-dynamic'

import { getTranslations } from 'next-intl/server'
import { AdminPageShell } from '../_components/AdminPageShell'
import { SupportManager } from '@/components/admin/SupportManager'

export default async function AdminSupportPage() {
  const t = await getTranslations('admin.support')

  return (
    <AdminPageShell title={t('pageTitle')} description={t('pageDescription')}>
      <SupportManager />
    </AdminPageShell>
  )
}