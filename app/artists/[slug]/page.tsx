/**
 * app/artists/[slug]/page.tsx — Artist profile page (RSC)
 *
 * Fetches artist by slug + their releases and concerts server-side.
 * Uses Next.js route-segment revalidation (60 s ISR) instead of
 * unstable_cache so that newly-created artists are always reachable
 * without a permanent 404 from a stale negative-cache entry.
 *
 * ── Data API Waterfall ──────────────────────────────────────────────────────
 * 1. `params.slug`              → URL slug of the artist
 * 2. `getArtistBySlug`          → SELECT * FROM artists WHERE slug = ?
 * 3. Parallel:
 *    `getReleasesByArtistId`    → SELECT * FROM releases WHERE artist_id = ?
 *    `getConcertsByArtistId`    → SELECT * FROM concerts WHERE artist_id = ?
 *    `getVideosByArtistId`      → SELECT * FROM videos WHERE artist_id = ?
 *    `getPublicNewsPosts`       → latest 3 news posts
 * 4. Dictionary                 → resolved from NEXT_LOCALE cookie / Accept-Language
 * ──────────────────────────────────────────────────────────────────────────
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getArtistBySlug, getPublicArtists } from '@/lib/api/artists'
import { getReleasesByArtistId } from '@/lib/api/releases'
import { getConcertsByArtistId } from '@/lib/api/concerts'
import { getVideosByArtistId } from '@/lib/api/videos'
import { getPublicNewsPostsByArtistId } from '@/lib/api/news'
import { getArtistAssets } from '@/lib/api/artistAssets'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { ArtistDetailContent } from './_components/ArtistDetailContent'

interface Props {
  params: Promise<{ slug: string }>
}

/** Opt-in ISR: revalidate every 60 s instead of using unstable_cache. */
export const revalidate = 60

/**
 * Allow slugs not returned by generateStaticParams to render on-demand
 * (ISR fallback). Without this explicit export Next.js 15 defaults to
 * dynamicParams = true, but being explicit prevents accidental regressions.
 */
export const dynamicParams = true

/**
 * Cookie-free Supabase client — safe inside RSC / ISR.
 * Uses the public anon key; RLS governs row visibility.
 */
function createPublicSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
  )
}

async function getArtistData(slug: string) {
  const client = createPublicSupabaseClient()
  // getArtistBySlug returns null when no artist matches the slug.
  // Any Supabase connection/auth error is allowed to throw so that Next.js
  // treats it as a server error (5xx) rather than caching it as a 404.
  const artist = await getArtistBySlug(client, slug)
  if (!artist) return null
  const [releases, concerts, videos, news, assets] = await Promise.all([
    getReleasesByArtistId(client, artist.id),
    getConcertsByArtistId(client, artist.id),
    getVideosByArtistId(client, artist.id),
    getPublicNewsPostsByArtistId(client, artist.id).then((posts) => posts.slice(0, 3)),
    getArtistAssets(client, artist.id).catch(() => []),
  ])
  return { artist, releases, concerts, videos, news, assets }
}

export async function generateStaticParams() {
  const client = createPublicSupabaseClient()
  const artists = await getPublicArtists(client).catch((error) => {
    console.error('generateStaticParams(/artists/[slug]) failed:', error)
    return []
  })
  return artists.map((artist) => ({ slug: artist.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  // Silently swallow errors only in metadata generation — a missing artist
  // just returns a generic title; the page itself will show the proper 404.
  const data = await getArtistData(slug).catch(() => null)
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
  // Do NOT swallow errors here — a Supabase failure must propagate so that
  // Next.js returns a 500 (uncached) rather than caching a false 404 for 60s.
  const [data, locale] = await Promise.all([
    getArtistData(slug),
    getLocale(),
  ])
  if (!data) notFound()
  const dict = await getDictionary(locale)
  const { artist, releases, concerts, videos, news, assets } = data
  return (
    <ArtistDetailContent
      artist={artist}
      releases={releases}
      concerts={concerts}
      videos={videos}
      news={news}
      assets={assets}
      dict={dict.artistDetail}
      consentDict={dict.consent}
      locale={locale}
    />
  )
}
