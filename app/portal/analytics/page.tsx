/**
 * app/portal/analytics/page.tsx — Streaming Analytics (Server Component)
 *
 * Fetches streaming stats server-side and passes aggregated data to the
 * chart leaf component. Follows IoC: leaf never fetches data itself.
 */

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import {
  getStreamingStatsByArtistId,
  getAggregatedStreamsByPlatform,
} from '@/lib/api/streamingStats'
import { Skeleton } from '@/components/ui/skeleton'
import { StreamingChart } from './_components/StreamingChart'
import { getPortalDictionary } from '@/i18n/getDictionary'

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

async function AnalyticsContent({ searchParams }: { searchParams: Promise<{ artistId?: string }> }) {
  const dict = await getPortalDictionary()
  const { artistId } = await searchParams

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch(() => null)
  const stats = artist
    ? await getStreamingStatsByArtistId(supabase, artist.id).catch(() => [])
    : []

  const aggregates = getAggregatedStreamsByPlatform(stats)

  return <StreamingChart dict={dict.portal} stats={stats} aggregates={aggregates} />
}

export default function AnalyticsPage({ searchParams }: { searchParams: Promise<{ artistId?: string }> }) {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsContent searchParams={searchParams} />
    </Suspense>
  )
}
