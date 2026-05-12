/**
 * app/portal/marketing/page.tsx — Marketing & Promo Links (Server Component)
 *
 * Fetches releases for the current artist and passes them to the SmartLinks component.
 */

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { getAssets } from '@/lib/api/assets'
import { Skeleton } from '@/components/ui/skeleton'
import { SmartLinks } from './_components/SmartLinks'

function MarketingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </div>
  )
}

async function MarketingContent() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const artist = await getArtistByUserId(supabase, user.id).catch(() => null)
  const flags = await getFeatureFlagsForRole(supabase, 'artist').catch(() => ({} as Record<string, boolean>))
  if (flags['artist.marketing'] === false) {
    return <p className="text-muted-foreground">Marketing module is currently disabled.</p>
  }
  const assets = artist ? await getAssets(supabase).catch(() => []) : []

  return <SmartLinks dict={dict.portal} assets={assets} />
}

export default function MarketingPage() {
  return (
    <Suspense fallback={<MarketingSkeleton />}>
      <MarketingContent />
    </Suspense>
  )
}
