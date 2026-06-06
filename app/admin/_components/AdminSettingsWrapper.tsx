'use client'

/**
 * app/admin/_components/AdminSettingsWrapper.tsx
 *
 * Client wrapper for the Settings admin page. Fetches site settings via
 * useSiteSettings and passes them as props to SiteSettingsManager and
 * RolesManager.
 *
 * Note: ColorThemeManager has moved to /admin/colors (its own dedicated tab).
 */

import { Suspense, lazy } from 'react'
import { useSiteSettings } from '@/hooks/useSiteSettings'

const SiteSettingsManager = lazy(() =>
  import('@/components/admin/SiteSettingsManager').then((m) => ({ default: m.SiteSettingsManager })),
)
const RolesManager = lazy(() =>
  import('@/components/admin/RolesManager').then((m) => ({ default: m.RolesManager })),
)

export function AdminSettingsWrapper() {
  const { settings, isLoading, saveSettings } = useSiteSettings()

  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
      <div className="space-y-8">
        <SiteSettingsManager value={settings} onChange={saveSettings} isLoading={isLoading} />
        <RolesManager />
      </div>
    </Suspense>
  )
}
