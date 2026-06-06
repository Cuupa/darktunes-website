'use client'

/**
 * app/admin/_components/AdminColorsWrapper.tsx
 *
 * Client wrapper for the Color Theme admin page.
 * Fetches site settings via useSiteSettings and passes them to
 * the full-featured ColorThemeManager component.
 */

import { Suspense, lazy } from 'react'
import { useSiteSettings } from '@/hooks/useSiteSettings'

const ColorThemeManager = lazy(() =>
  import('@/components/admin/ColorThemeManager').then((m) => ({ default: m.ColorThemeManager })),
)

export function AdminColorsWrapper() {
  const { settings, isLoading, saveSettings } = useSiteSettings()

  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
      <ColorThemeManager value={settings} onChange={saveSettings} isLoading={isLoading} />
    </Suspense>
  )
}
