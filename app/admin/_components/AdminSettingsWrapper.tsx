'use client'

/**
 * app/admin/_components/AdminSettingsWrapper.tsx
 *
 * Client wrapper for the settings admin page. Fetches site settings via
 * useSiteSettings and passes them as props to SiteSettingsManager and
 * ColorThemeManager, satisfying their required AdminPanelProps contracts.
 */

import { Suspense, lazy } from 'react'
import { useSiteSettings } from '@/hooks/useSiteSettings'

const SiteSettingsManager = lazy(() =>
  import('@/components/admin/SiteSettingsManager').then((m) => ({ default: m.SiteSettingsManager })),
)
const ColorThemeManager = lazy(() =>
  import('@/components/admin/ColorThemeManager').then((m) => ({ default: m.ColorThemeManager })),
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
        <ColorThemeManager value={settings} onChange={saveSettings} isLoading={isLoading} />
        <RolesManager />
      </div>
    </Suspense>
  )
}
