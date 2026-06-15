/**
 * app/portal/analytics/page.tsx — Portal Analytics (Server Component)
 *
 * Fetches streaming stats AND royalty statements server-side and passes
 * aggregated data to the chart leaf components. Follows IoC: leaves never
 * fetch data themselves.
 *
 * Two tabs:
 *   - Streaming: monthly Spotify/Apple Music stream counts
 *   - Einnahmen: royalty earnings from sales_statements
 */

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import {
  getStreamingStatsByArtistId,
  getAggregatedStreamsByPlatform,
} from '@/lib/api/streamingStats'
import { getSalesStatementsByArtistId } from '@/lib/api/salesStatements'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StreamingChart } from './_components/StreamingChart'
import { EarningsChart } from './_components/EarningsChart'
import { getPortalDictionary } from '@/i18n/getDictionary'

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

async function AnalyticsContent({ searchParams }: { searchParams: Promise<{ artistId?: string; tab?: string }> }) {
  const dict = await getPortalDictionary()
  const { artistId, tab } = await searchParams

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch(() => null)

  const [stats, statements] = await Promise.all([
    artist ? getStreamingStatsByArtistId(supabase, artist.id).catch(() => []) : Promise.resolve([]),
    artist ? getSalesStatementsByArtistId(supabase, artist.id).catch(() => []) : Promise.resolve([]),
  ])

  const aggregates = getAggregatedStreamsByPlatform(stats)
  const defaultTab = tab === 'earnings' ? 'earnings' : 'streaming'

  return (
    <Tabs defaultValue={defaultTab} className="space-y-6">
      <TabsList className="bg-card border border-border">
        <TabsTrigger value="streaming">{dict.portal.analytics_tab_streaming}</TabsTrigger>
        <TabsTrigger value="earnings">{dict.portal.analytics_tab_earnings}</TabsTrigger>
      </TabsList>

      <TabsContent value="streaming" className="mt-0">
        <StreamingChart dict={dict.portal} stats={stats} aggregates={aggregates} />
      </TabsContent>

      <TabsContent value="earnings" className="mt-0">
        <EarningsChart dict={dict.portal} statements={statements} />
      </TabsContent>
    </Tabs>
  )
}

export default function AnalyticsPage({ searchParams }: { searchParams: Promise<{ artistId?: string; tab?: string }> }) {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsContent searchParams={searchParams} />
    </Suspense>
  )
}
