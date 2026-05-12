/**
 * app/artists/[slug]/page.tsx — Artist profile page (RSC)
 *
 * Fetches artist by slug + their releases and concerts server-side.
 * Uses unstable_cache for ISR with 60-second revalidation.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistBySlug } from '@/lib/api/artists'
import { getReleasesByArtistId } from '@/lib/api/releases'
import { getConcertsByArtistId } from '@/lib/api/concerts'
import { getVideosByArtistId } from '@/lib/api/videos'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { ArtistDetailContent } from './_components/ArtistDetailContent'

interface Props {
  params: Promise<{ slug: string }>
}

function makeGetArtistData(slug: string) {
  return unstable_cache(
    async () => {
      const client = await createServerSupabaseClient()
      const artist = await getArtistBySlug(client, slug)
      if (!artist) return null
      const [releases, concerts, videos] = await Promise.all([
        getReleasesByArtistId(client, artist.id),
        getConcertsByArtistId(client, artist.id),
        getVideosByArtistId(client, artist.id),
      ])
      return { artist, releases, concerts, videos }
    },
    [`artist-detail-${slug}`],
    { revalidate: 60, tags: ['artists', 'releases', 'concerts', 'videos'] },
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await makeGetArtistData(slug)().catch(() => null)
  if (!data) return { title: 'Artist not found — darkTunes' }
  const { artist } = data
  return {
    title: `${artist.name} | darkTunes Music Group`,
    description: artist.bio ? artist.bio.slice(0, 160) : `${artist.name} on darkTunes Music Group`,
    openGraph: {
      title: `${artist.name} — darkTunes Music Group`,
      description: artist.bio ? artist.bio.slice(0, 160) : undefined,
      images: artist.imageUrl ? [{ url: artist.imageUrl }] : [],
      type: 'profile',
    },
  }
}

export default async function ArtistDetailPage({ params }: Props) {
  const { slug } = await params
  const [data, locale] = await Promise.all([
    makeGetArtistData(slug)().catch(() => null),
    getLocale(),
  ])
  if (!data) notFound()
  const dict = await getDictionary(locale)
  const { artist, releases, concerts, videos } = data
  return (
    <ArtistDetailContent
      artist={artist}
      releases={releases}
      concerts={concerts}
      videos={videos}
      dict={dict.artistDetail}
      consentDict={dict.consent}
      locale={locale}
    />
  )
}
