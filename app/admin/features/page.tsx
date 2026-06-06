/**
 * app/admin/features/page.tsx — Feature Flags & Toggles
 */

export const dynamic = 'force-dynamic'

import { Suspense, lazy } from 'react'
import { AdminPageShell } from '../../_components/AdminPageShell'

const FeatureTogglesManager = lazy(() =>
  import('@/components/admin/FeatureTogglesManager').then((m) => ({ default: m.FeatureTogglesManager })),
)
const FeatureFlagsManager = lazy(() =>
  import('@/components/admin/FeatureFlagsManager').then((m) => ({ default: m.FeatureFlagsManager })),
)

export default function AdminFeaturesPage() {
  return (
    <AdminPageShell title="Feature Flags" description="Enable or disable portal modules and rollout flags globally.">
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading…</div>}>
        <div className="space-y-8">
          <FeatureTogglesManager />
          <FeatureFlagsManager />
        </div>
      </Suspense>
    </AdminPageShell>
  )
}
