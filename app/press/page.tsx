/**
 * app/press/page.tsx — Public Electronic Press Kit (Server Component)
 *
 * Fetches all EPK data server-side (IoC) and passes it to PressPageClient.
 * Data: press photos, artist bios, tour dates, press quote.
 * No authentication required — fully public.
 */

export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getPressPhotos } from '@/lib/api/pressPhotos'
import { getArtists } from '@/lib/api/artists'
import { getArtistProfileByArtistId } from '@/lib/api/artistProfiles'
import { getConcerts } from '@/lib/api/concerts'
import { PressPageClient } from './_components/PressPageClient'

export const metadata: Metadata = {
  title: 'Press & Media — darkTunes Music Group',
  description:
    'Electronic Press Kit — bios, high-resolution press photos, and tour dates for darkTunes Music Group artists.',
  openGraph: {
    title: 'Press & Media — darkTunes Music Group',
    description:
      'Official Electronic Press Kit. Download hi-res photos and artist bios for editorial use.',
  },
}

export default async function PressPage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const supabase = await createServerSupabaseClient()

  const [photos, concerts, artists] = await Promise.all([
    getPressPhotos(supabase).catch(() => []),
    getConcerts(supabase).catch(() => []),
    getArtists(supabase).catch(() => []),
  ])

  const featured = artists.find((a) => a.featured) ?? artists[0]
  const profile = featured
    ? await getArtistProfileByArtistId(supabase, featured.id).catch(() => null)
    : null

  return (
    <PressPageClient
      dict={dict}
      photos={photos}
      concerts={concerts}
      profile={profile}
      artistName={featured?.name ?? 'darkTunes'}
    />
  )
}
