'use client'

/**
 * app/admin/accounting/page.tsx
 *
 * The Accounting section of the admin area.
 * Tab A: Generate Statements (SOS Generator embedded, artists from Supabase).
 * Tab B: Statement History (existing read-only StatementsManager).
 */

import { AccountingPanel } from '@/components/admin/AccountingPanel'
import { AdminPageShell } from '../_components/AdminPageShell'
import { useDict } from '@/contexts/DictContext'

export default function AccountingPage() {
  const dict = useDict()
  const t = dict.admin?.accounting ?? {
    pageTitle: 'Accounting',
    pageDescription: 'Generate royalty statements for artists and review statement history.',
  }

  return (
    <AdminPageShell
      title={t.pageTitle}
      description={t.pageDescription}
    >
      <AccountingPanel />
    </AdminPageShell>
  )
}