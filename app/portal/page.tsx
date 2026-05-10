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
import { getSalesStatementsByArtistId } from '@/lib/api/salesStatements'
import { getReleasesByArtistId } from '@/lib/api/releases'
import { getConcertsByArtistId } from '@/lib/api/concerts'
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

  const [stats, statements, releases, concerts] = artist
    ? await Promise.all([
        getStreamingStatsByArtistId(supabase, artist.id).catch(() => []),
        getSalesStatementsByArtistId(supabase, artist.id).catch(() => []),
        getReleasesByArtistId(supabase, artist.id).catch(() => []),
        getConcertsByArtistId(supabase, artist.id).catch(() => []),
      ])
    : [[], [], [], []]

  const aggregates = getAggregatedStreamsByPlatform(stats)
  const totalStreams = aggregates.reduce((sum, p) => sum + p.totalStreams, 0)

  return (
    <PortalOverview
      dict={dict.portal}
      artistName={artist?.name ?? null}
      totalStreams={totalStreams}
      statementCount={statements.length}
      releaseCount={releases.length}
      upcomingShowCount={concerts.length}
    />
  )
}
