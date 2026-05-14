/**
 * app/artists/[slug]/page.tsx — Artist profile page (RSC)
 *
 * Fetches artist by slug + their releases and concerts server-side.
 * Uses unstable_cache for ISR with 60-second revalidation.
 *
 * ── Data API Waterfall ──────────────────────────────────────────────────────
 * 1. `params.slug`              → URL slug of the artist
 * 2. `getArtistBySlug`          → SELECT * FROM artists WHERE slug = ?
 *                                 (RLS: only visible artists returned to anon)
 * 3. `getReleasesByArtistId`    → SELECT * FROM releases WHERE artist_id = ?
 *                                 ordered by release_date DESC
 *    `getConcertsByArtistId`    → SELECT * FROM concerts WHERE artist_id = ?
 *                                 filtered to future dates, ordered by date ASC
 *    `getVideosByArtistId`      → SELECT * FROM videos WHERE artist_id = ?
 *                                 ordered by published_at DESC
 * 4. Dictionary                 → resolved from NEXT_LOCALE cookie / Accept-Language
 *
 * Steps 3 + 4 run in parallel via Promise.all after step 2 resolves.
 * The Supabase queries use a cookie-free public client (anon key) so they can
 * be safely cached by unstable_cache without hitting Next.js 15's
 * "cookies() not available inside unstable_cache" restriction.
 * ──────────────────────────────────────────────────────────────────────────
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getArtistBySlug, getPublicArtists } from '@/lib/api/artists'
import { getReleasesByArtistId } from '@/lib/api/releases'
import { getConcertsByArtistId } from '@/lib/api/concerts'
import { getVideosByArtistId } from '@/lib/api/videos'
import { getPublicNewsPosts } from '@/lib/api/news'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { ArtistDetailContent } from './_components/ArtistDetailContent'

interface Props {
  params: Promise<{ slug: string }>
}

/**
 * Cookie-free Supabase client — safe to use inside unstable_cache.
 *
 * In Next.js 15, dynamic APIs like cookies() cannot be called inside
 * unstable_cache callbacks.  For public read operations the anon key with
 * RLS is sufficient; no session cookie is required.
 */
function createPublicSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
  )
}

function makeGetArtistData(slug: string) {
  return unstable_cache(
    async () => {
      const client = createPublicSupabaseClient()
      const artist = await getArtistBySlug(client, slug)
      if (!artist) return null
      const [releases, concerts, videos, news] = await Promise.all([
        getReleasesByArtistId(client, artist.id),
        // Concerts include Songkick + Bandsintown records upserted into `concerts`.
        getConcertsByArtistId(client, artist.id),
        getVideosByArtistId(client, artist.id),
        getPublicNewsPosts(client).then((posts) => posts.slice(0, 3)),
      ])
      return { artist, releases, concerts, videos, news }
    },
    [`artist-detail-${slug}`],
    { revalidate: 60, tags: ['artists', 'releases', 'concerts', 'videos', 'news'] },
  )
}

export async function generateStaticParams() {
  const client = createPublicSupabaseClient()
  const artists = await getPublicArtists(client).catch(() => [])
  return artists.map((artist) => ({ slug: artist.slug }))
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
  const { artist, releases, concerts, videos, news } = data
  return (
    <ArtistDetailContent
      artist={artist}
      releases={releases}
      concerts={concerts}
      videos={videos}
      news={news}
      dict={dict.artistDetail}
      consentDict={dict.consent}
      locale={locale}
    />
  )
}
