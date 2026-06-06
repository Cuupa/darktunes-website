/**
 * app/admin/features/page.tsx — Feature Flags & Toggles
 */

export const dynamic = 'force-dynamic'

import { AdminPageShell } from '../_components/AdminPageShell'
import { AdminFeaturesWrapper } from '../_components/AdminFeaturesWrapper'

export default function AdminFeaturesPage() {
  return (
    <AdminPageShell title="Feature Flags" description="Enable or disable portal modules and rollout flags globally.">
      <AdminFeaturesWrapper />
    </AdminPageShell>
  )
}
