/**
 * app/admin/features/page.tsx — Feature Flags & Toggles
 */

export const dynamic = 'force-dynamic'

import { requirePageCapability } from '@/lib/rbac'
import { AdminPageShell } from '../_components/AdminPageShell'
import { AdminFeaturesWrapper } from '../_components/AdminFeaturesWrapper'

export default async function AdminFeaturesPage() {
  await requirePageCapability('admin.panel.full')

  return (
    <AdminPageShell title="Feature Flags" description="Enable or disable portal modules and rollout flags globally.">
      <AdminFeaturesWrapper />
    </AdminPageShell>
  )
}
