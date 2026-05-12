/**
 * app/portal/page.tsx — Artist Portal overview (Server Component)
 *
 * Dashboard overview: shows artist name, quick links to all portal sections.
 * Data is fetched server-side and passed as props to the client leaf.
 */

export const dynamic = 'force-dynamic'

import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { getStreamingStatsByArtistId, getAggregatedStreamsByPlatform } from '@/lib/api/streamingStats'
import { getReleasesByArtistId } from '@/lib/api/releases'
import { getConcertsByArtistId } from '@/lib/api/concerts'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
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

  const [stats, releases, concerts, openChecklistCountResult, featureFlags, profileResult] = artist
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
        supabase
          .from('artist_profiles')
          .select('photo_url')
          .eq('artist_id', artist.id)
          .maybeSingle(),
      ])
    : [[], [], [], { count: 0, error: null }, {}, { data: null, error: null }]

  const aggregates = getAggregatedStreamsByPlatform(stats)
  const totalStreams = aggregates.reduce((sum, p) => sum + p.totalStreams, 0)

  return (
    <PortalOverview
      dict={dict.portal}
      artistName={artist?.name ?? null}
      profileImageUrl={profileResult.data?.photo_url ?? artist?.imageUrl ?? null}
      totalStreams={totalStreams}
      releaseCount={releases.length}
      upcomingShowCount={concerts.length}
      openChecklistCount={openChecklistCountResult.count ?? 0}
      featureFlags={featureFlags}
    />
  )
}
