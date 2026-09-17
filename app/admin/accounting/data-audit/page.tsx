/**
 * app/admin/accounting/data-audit/page.tsx — Read-only SOS settlement data audit
 */

export const dynamic = 'force-dynamic'

import { getTranslations } from 'next-intl/server'
import { AdminPageShell } from '../../_components/AdminPageShell'
import { SettlementDataAuditPanel } from '@/components/admin/sos/SettlementDataAuditPanel'

export default async function SettlementDataAuditPage() {
  const t = await getTranslations('admin.accounting.dataAudit')

  return (
    <AdminPageShell title={t('title')} description={t('description')} layout="list">
      <SettlementDataAuditPanel />
    </AdminPageShell>
  )
}
