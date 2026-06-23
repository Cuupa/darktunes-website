/**
 * app/portal/page.tsx — Artist Portal overview (Server Component)
 *
 * Dashboard overview: shows artist name, quick links to all portal sections.
 * Data is fetched server-side and passed as props to the client leaf.
 */

export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistProfileByArtistId, resolvePortalArtist } from '@/lib/api/artistProfiles'
import { countAssetsByArtist } from '@/lib/api/assets'
import { getStreamingStatsByArtistId, getAggregatedStreamsByPlatform } from '@/lib/api/streamingStats'
import { getReleasesByArtistId } from '@/lib/api/releases'
import { getConcertsByArtistId } from '@/lib/api/concerts'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { calcProfileCompletion } from '@/lib/portal/profileCompletion'
import { safeHeadCount } from '@/lib/portal/safeQuery'
import { PortalOverview } from './_components/PortalOverview'
import { getPortalDictionary } from '@/i18n/getDictionary'

export default async function PortalPage({ searchParams }: { searchParams: Promise<{ artistId?: string }> }) {
  const dict = await getPortalDictionary()
  const { artistId } = await searchParams

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch(() => null)

  const [stats, releases, concerts, openChecklistCount, featureFlags, artistProfile, statementCount, assetCount] = artist
    ? await Promise.all([
        getStreamingStatsByArtistId(supabase, artist.id).catch(() => []),
        getReleasesByArtistId(supabase, artist.id).catch(() => []),
        getConcertsByArtistId(supabase, artist.id).catch(() => []),
        safeHeadCount(
          supabase
            .from('release_checklists')
            .select('id', { count: 'exact', head: true })
            .eq('artist_id', artist.id)
            .eq('is_completed', false),
        ),
        getFeatureFlagsForRole(supabase, 'artist').catch(() => ({} as Record<string, boolean>)),
        getArtistProfileByArtistId(supabase, artist.id).catch(() => null),
        safeHeadCount(
          supabase
            .from('sales_statements')
            .select('id', { count: 'exact', head: true })
            .eq('artist_id', artist.id),
        ),
        countAssetsByArtist(supabase, artist.id).catch(() => 0),
      ])
    : [[], [], [], 0, {}, null, 0, 0]

  const aggregates = getAggregatedStreamsByPlatform(stats)
  const totalStreams = aggregates.reduce((sum, p) => sum + p.totalStreams, 0)

  const { score: completionScore, missing: missingFields } = artist
    ? calcProfileCompletion(artist, artistProfile)
    : { score: 0, missing: [] }

  return (
    <PortalOverview
      dict={dict.portal}
      artistName={artist?.name ?? null}
      profileImageUrl={artist?.imageUrl ?? null}
      totalStreams={totalStreams}
      releaseCount={releases.length}
      upcomingShowCount={concerts.length}
      openChecklistCount={openChecklistCount}
      statementCount={statementCount}
      assetCount={assetCount}
      featureFlags={featureFlags}
      completionScore={completionScore}
      missingFields={missingFields}
    />
  )
}
