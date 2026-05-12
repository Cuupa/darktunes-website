export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { getPromoReleases } from '@/lib/api/releases'
import { PromoDownloads } from './_components/PromoDownloads'

export default async function PressPromoPoolPage() {
  const supabase = await createServerSupabaseClient()
  const flags = await getFeatureFlagsForRole(supabase, 'journalist').catch(() => ({} as Record<string, boolean>))
  if (flags['journalist.promo_pool'] === false) {
    return <p className="text-muted-foreground">Promo pool is currently disabled.</p>
  }

  const releases = await getPromoReleases(supabase).catch(() => [])

  return <PromoDownloads releases={releases} />
}
