/**
 * app/portal/page.tsx — Artist Portal overview (Server Component)
 *
 * Dashboard overview: shows artist name, quick links to all portal sections.
 * Data is fetched server-side and passed as props to the client leaf.
 */

export const dynamic = 'force-dynamic'

import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId, getArtistProfileByArtistId } from '@/lib/api/artistProfiles'
import { getStreamingStatsByArtistId, getAggregatedStreamsByPlatform } from '@/lib/api/streamingStats'
import { getReleasesByArtistId } from '@/lib/api/releases'
import { getConcertsByArtistId } from '@/lib/api/concerts'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { calcProfileCompletion } from '@/lib/portal/profileCompletion'
import { PortalOverview } from './_components/PortalOverview'

export default async function PortalPage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const artist = await getArtistByUserId(supabase, user.id).catch(() => null)

  const [stats, releases, concerts, openChecklistCountResult, featureFlags, artistProfile, statementCountResult, assetCountResult] = artist
    ? await Promise.all([
        getStreamingStatsByArtistId(supabase, artist.id).catch(() => []),
        getReleasesByArtistId(supabase, artist.id).catch(() => []),
        getConcertsByArtistId(supabase, artist.id).catch(() => []),
        supabase
          .from('release_checklists')
          .select('id', { count: 'exact', head: true })
          .eq('artist_id', artist.id)
          .eq('is_completed', false),
        getFeatureFlagsForRole(supabase, 'artist').catch(() => ({} as Record<string, boolean>)),
        getArtistProfileByArtistId(supabase, artist.id).catch(() => null),
        supabase
          .from('sales_statements')
          .select('id', { count: 'exact', head: true })
          .eq('artist_id', artist.id),
        supabase.from('assets').select('id', { count: 'exact', head: true }),
      ])
    : [[], [], [], { count: 0, error: null }, {}, null, { count: 0, error: null }, { count: 0, error: null }]

  const aggregates = getAggregatedStreamsByPlatform(stats)
  const totalStreams = aggregates.reduce((sum, p) => sum + p.totalStreams, 0)

  const { score: completionScore, missing: missingFields } = artist
    ? calcProfileCompletion(artist, artistProfile)
    : { score: 0, missing: [] }

  return (
    <PortalOverview
      dict={dict.portal}
      artistName={artist?.name ?? null}
      profileImageUrl={artistProfile?.photoUrl ?? artist?.imageUrl ?? null}
      totalStreams={totalStreams}
      releaseCount={releases.length}
      upcomingShowCount={concerts.length}
      openChecklistCount={openChecklistCountResult.count ?? 0}
      statementCount={statementCountResult.count ?? 0}
      assetCount={assetCountResult.count ?? 0}
      featureFlags={featureFlags}
      completionScore={completionScore}
      missingFields={missingFields}
    />
  )
}
