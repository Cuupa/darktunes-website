'use client'

/**
 * app/admin/_components/AdminFeaturesWrapper.tsx
 *
 * Client wrapper for the features admin page. Fetches site settings via
 * useSiteSettings and passes featureToggles as props to FeatureTogglesManager,
 * satisfying its required FeatureTogglesManagerProps contract.
 */

import { Suspense, lazy } from 'react'
import { useTranslations } from 'next-intl'
import { useSiteSettings } from '@/hooks/useSiteSettings'

const FeatureTogglesManager = lazy(() =>
  import('@/components/admin/FeatureTogglesManager').then((m) => ({ default: m.FeatureTogglesManager })),
)
const FeatureFlagsManager = lazy(() =>
  import('@/components/admin/FeatureFlagsManager').then((m) => ({ default: m.FeatureFlagsManager })),
)

export function AdminFeaturesWrapper() {
  const t = useTranslations('admin.features')
  const { settings, isLoading, saveSettings } = useSiteSettings()

  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
      <div className="space-y-10">
        <section className="space-y-4" aria-labelledby="admin-features-global-heading">
          <header className="space-y-1">
            <h2 id="admin-features-global-heading" className="text-lg font-semibold">
              {t('globalSectionTitle')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('globalSectionDescription')}</p>
          </header>
          <FeatureTogglesManager
            value={settings.featureToggles ?? { promoPool: true, editorTools: true }}
            onChange={(toggles) => void saveSettings({ ...settings, featureToggles: toggles })}
            isLoading={isLoading}
          />
        </section>

        <section className="space-y-4" aria-labelledby="admin-features-portal-heading">
          <header className="space-y-1">
            <h2 id="admin-features-portal-heading" className="text-lg font-semibold">
              {t('portalSectionTitle')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('portalSectionDescription')}</p>
          </header>
          <FeatureFlagsManager />
        </section>
      </div>
    </Suspense>
  )
}