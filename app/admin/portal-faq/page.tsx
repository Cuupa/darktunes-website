/**
 * app/admin/portal-faq/page.tsx — Artist Portal FAQ CMS
 */

export const dynamic = 'force-dynamic'

import { getTranslations } from 'next-intl/server'
import { AdminPageShell } from '../_components/AdminPageShell'
import { PortalFaqManager } from '@/components/admin/PortalFaqManager'

export default async function AdminPortalFaqPage() {
  const t = await getTranslations('admin.portalFaq')

  return (
    <AdminPageShell title={t('pageTitle')} description={t('pageDescription')}>
      <PortalFaqManager />
    </AdminPageShell>
  )
}