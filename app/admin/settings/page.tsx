/**
 * app/admin/settings/page.tsx — Site Settings, Colors & Roles
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../../_components/AdminPageShell'

const SiteSettingsManager = lazy(() =>
  import('@/components/admin/SiteSettingsManager').then((m) => ({ default: m.SiteSettingsManager })),
)
const ColorThemeManager = lazy(() =>
  import('@/components/admin/ColorThemeManager').then((m) => ({ default: m.ColorThemeManager })),
)
const RolesManager = lazy(() =>
  import('@/components/admin/RolesManager').then((m) => ({ default: m.RolesManager })),
)

export default function AdminSettingsPage() {
  return (
    <AdminPageShell title="Settings" description="Manage site settings, color theme, and role permissions.">
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <div className="space-y-8">
          <SiteSettingsManager />
          <ColorThemeManager />
          <RolesManager />
        </div>
      </Suspense>
    </AdminPageShell>
  )
}
