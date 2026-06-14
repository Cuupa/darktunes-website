/**
 * app/admin/settings/page.tsx — Site Settings, Colors & Roles
 */

export const dynamic = 'force-dynamic'

import { AdminPageShell } from '../_components/AdminPageShell'
import { AdminSettingsWrapper } from '../_components/AdminSettingsWrapper'

export default function AdminSettingsPage() {
  return (
    <AdminPageShell title="Settings" description="Manage site settings and role permissions.">
      <AdminSettingsWrapper />
    </AdminPageShell>
  )
}
