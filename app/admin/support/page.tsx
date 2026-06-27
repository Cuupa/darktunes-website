/**
 * app/admin/support/page.tsx — Manual support tickets & Zammad integration
 */

export const dynamic = 'force-dynamic'

import { AdminPageShell } from '../_components/AdminPageShell'
import { SupportManager } from '@/components/admin/SupportManager'

export default function AdminSupportPage() {
  return (
    <AdminPageShell
      title="Support"
      description="Submit support requests to Zammad, manage known error filters, and review ticket delivery."
    >
      <SupportManager />
    </AdminPageShell>
  )
}