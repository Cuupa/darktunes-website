/**
 * app/portal/analytics/page.tsx — Portal Analytics (Server Component)
 *
 * Fetches streaming stats, territory metrics, event impact, concerts,
 * and royalty statements server-side and passes aggregated data to chart leaves.
 */

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createReplicaSupabaseClient } from '@/lib/supabase/replica'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { getStreamingStatsByArtistId } from '@/lib/api/streamingStats'
import { getTerritoryMetricsByArtistId } from '@/lib/api/artistTerritoryMetrics'
import { getEventImpactByArtistId } from '@/lib/api/eventImpact'
import { getListenerMetricsByArtistId } from '@/lib/api/artistListenerMetrics'
import { getConcertsByArtistId } from '@/lib/api/concerts'
import { getBillingProfile, isBillingProfileComplete } from '@/lib/api/artistBillingProfiles'
import { listArtistInvoices } from '@/lib/api/artistInvoices'
import { getSalesStatementsByArtistId } from '@/lib/api/salesStatements'
import { Skeleton } from '@/components/ui/skeleton'
import { AnalyticsPageClient } from './_components/AnalyticsPageClient'
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

async function AnalyticsContent({
  searchParams,
}: {
  searchParams: Promise<{ artistId?: string; tab?: string }>
}) {
  const dict = await getPortalDictionary()
  const { artistId, tab } = await searchParams

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const flags = await getFeatureFlagsForRole(supabase, 'artist').catch(() => ({} as Record<string, boolean>))
  if (flags['artist.analytics'] === false) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{dict.portal.analytics_dashboard_heading}</h1>
        <p className="text-muted-foreground">{dict.portal.analytics_unavailable}</p>
      </div>
    )
  }

  const readDb = createReplicaSupabaseClient()
  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch(() => null)

  const [
    stats,
    statements,
    territoryMetrics,
    eventImpacts,
    listenerMetrics,
    concerts,
    billingProfile,
    invoiceList,
  ] = await Promise.all([
    artist ? getStreamingStatsByArtistId(readDb, artist.id).catch(() => []) : Promise.resolve([]),
    artist ? getSalesStatementsByArtistId(readDb, artist.id).catch(() => []) : Promise.resolve([]),
    artist ? getTerritoryMetricsByArtistId(readDb, artist.id).catch(() => []) : Promise.resolve([]),
    artist ? getEventImpactByArtistId(readDb, artist.id).catch(() => []) : Promise.resolve([]),
    artist ? getListenerMetricsByArtistId(readDb, artist.id).catch(() => []) : Promise.resolve([]),
    artist ? getConcertsByArtistId(readDb, artist.id).catch(() => []) : Promise.resolve([]),
    artist ? getBillingProfile(supabase, artist.id).catch(() => null) : Promise.resolve(null),
    artist
      ? listArtistInvoices(supabase, artist.id, 1, 200).catch(() => ({ invoices: [], total: 0 }))
      : Promise.resolve({ invoices: [], total: 0 }),
  ])

  const defaultTab =
    tab === 'earnings'
      ? 'earnings'
      : tab === 'territories'
        ? 'territories'
        : tab === 'events'
          ? 'events'
          : tab === 'listeners'
            ? 'listeners'
            : 'streaming'

  return (
    <AnalyticsPageClient
      artistId={artist?.id ?? ''}
      billingProfileComplete={isBillingProfileComplete(billingProfile)}
      dict={dict.portal}
      defaultTab={defaultTab}
      invoicedStatementIds={invoiceList.invoices.flatMap((invoice) =>
        invoice.statementId ? [invoice.statementId] : [],
      )}
      stats={stats}
      statements={statements}
      territoryMetrics={territoryMetrics}
      eventImpacts={eventImpacts}
      listenerMetrics={listenerMetrics}
      concerts={concerts}
    />
  )
}

export default function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ artistId?: string; tab?: string }>
}) {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsContent searchParams={searchParams} />
    </Suspense>
  )
}