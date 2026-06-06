/**
 * app/admin/system/page.tsx — System Health, Logs & Media
 */

export const dynamic = 'force-dynamic'

import { AdminPageShell } from '../_components/AdminPageShell'
import { AdminSystemWrapper } from '../_components/AdminSystemWrapper'

export default function AdminSystemPage() {
  return (
    <AdminPageShell title="System" description="Monitor system health, audit logs, and manage media files.">
      <AdminSystemWrapper />
    </AdminPageShell>
  )
}
