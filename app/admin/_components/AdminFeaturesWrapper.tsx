'use client'

/**
 * app/admin/_components/AdminFeaturesWrapper.tsx
 *
 * Client wrapper for the features admin page. Fetches site settings via
 * useSiteSettings and passes featureToggles as props to FeatureTogglesManager,
 * satisfying its required FeatureTogglesManagerProps contract.
 */

import { Suspense, lazy } from 'react'
import { useSiteSettings } from '@/hooks/useSiteSettings'

const FeatureTogglesManager = lazy(() =>
  import('@/components/admin/FeatureTogglesManager').then((m) => ({ default: m.FeatureTogglesManager })),
)
const FeatureFlagsManager = lazy(() =>
  import('@/components/admin/FeatureFlagsManager').then((m) => ({ default: m.FeatureFlagsManager })),
)

export function AdminFeaturesWrapper() {
  const { settings, isLoading, saveSettings } = useSiteSettings()

  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
      <div className="space-y-8">
        <FeatureTogglesManager
          value={settings.featureToggles ?? { promoPool: true, editorTools: true }}
          onChange={(toggles) => void saveSettings({ ...settings, featureToggles: toggles })}
          isLoading={isLoading}
        />
        <FeatureFlagsManager />
      </div>
    </Suspense>
  )
}
