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

export default function AccountingPage() {
  return (
    <AdminPageShell
      title="Accounting"
      description="Generate royalty statements for artists and review statement history."
    >
      <AccountingPanel />
    </AdminPageShell>
  )
}
