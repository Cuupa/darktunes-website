/**
 * app/page.tsx — Home page (React Server Component)
 *
 * Data is fetched server-side here using the Supabase server client.
 * Next.js 15 no longer caches fetch/GET by default, so we explicitly wrap
 * queries in unstable_cache with revalidation tags and a 60-second TTL.
 * This prevents per-request Supabase queries while keeping data fresh.
 *
 * The fetched data is passed as props to HomePageContent (Client Component)
 * following the IoC principle: RSC owns data fetching, client owns rendering.
 */

import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { HomePageContent } from './_components/HomePageContent'
import { getPublicReleases } from '@/lib/api/releases'
import { getPublicArtists } from '@/lib/api/artists'
import { getNewsPosts } from '@/lib/api/news'
import { getVideos } from '@/lib/api/videos'
import { getPublicConcerts } from '@/lib/api/concerts'
import { getSiteSettings } from '@/lib/api/siteSettings'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import type { Release, Artist, NewsPost, Video, SiteSettings, Concert } from '@/types'
import type { Database } from '@/types/database'

// ---------------------------------------------------------------------------
// Public Supabase client — no cookies() dependency
// Safe to use inside unstable_cache callbacks where Next.js Dynamic APIs
// (cookies, headers) are unavailable. All data fetched here is publicly
// readable (RLS: FOR SELECT USING (TRUE)).
// ---------------------------------------------------------------------------

function createPublicSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
  )
}

// ---------------------------------------------------------------------------
// Cached data-fetching helpers
// Next.js 15: explicit caching with tags for on-demand revalidation
// ---------------------------------------------------------------------------

const getCachedReleases = unstable_cache(
  async (): Promise<Release[]> => {
    return getPublicReleases(createPublicSupabaseClient())
  },
  ['releases'],
  { revalidate: 60, tags: ['releases'] },
)

const getCachedArtists = unstable_cache(
  async (): Promise<Artist[]> => {
    return getPublicArtists(createPublicSupabaseClient())
  },
  ['artists'],
  { revalidate: 60, tags: ['artists'] },
)

const getCachedNews = unstable_cache(
  async (): Promise<NewsPost[]> => {
    return getNewsPosts(createPublicSupabaseClient())
  },
  ['news'],
  { revalidate: 60, tags: ['news'] },
)

const getCachedVideos = unstable_cache(
  async (): Promise<Video[]> => {
    return getVideos(createPublicSupabaseClient())
  },
  ['videos'],
  { revalidate: 60, tags: ['videos'] },
)

const getCachedConcerts = unstable_cache(
  async (): Promise<Concert[]> => {
    return getPublicConcerts(createPublicSupabaseClient())
  },
  ['concerts'],
  { revalidate: 60, tags: ['concerts'] },
)

const getCachedSiteSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    return getSiteSettings(createPublicSupabaseClient())
  },
  ['site-settings'],
  { revalidate: 60, tags: ['site-settings'] },
)

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function HomePage() {
  // Fetch all data in parallel on the server
  const [releases, artists, news, videos, concerts, siteSettings, locale] = await Promise.all([
    getCachedReleases().catch(() => [] as Release[]),
    getCachedArtists().catch(() => [] as Artist[]),
    getCachedNews().catch(() => [] as NewsPost[]),
    getCachedVideos().catch(() => [] as Video[]),
    getCachedConcerts().catch(() => [] as Concert[]),
    getCachedSiteSettings().catch(
      (): SiteSettings => ({
        labelName: 'darkTunes Music Group',
        labelTagline: "We don't follow trends—we create them.",
        contactEmail: 'info@darktunes.com',
        privacyPolicyUrl: '/datenschutz',
        termsUrl: '/impressum',
        instagramUrl: 'https://instagram.com/darktunes',
        youtubeUrl: 'https://youtube.com/@darktunes',
        spotifyUrl: 'https://open.spotify.com/user/darktunes',
        spotifyPlaylistUri: '37i9dQZF1DWWqNV5cS50j6',
        spotifyPlaylists: [],
        heroBadge: '⚡ New Release',
        heroDescription:
          'Experience the latest evolution in alternative music. A sonic journey that pushes boundaries and defies expectations.',
        seoTitle: 'darkTunes Music Group',
        seoDescription:
          'Official website for darkTunes Music Group — an alternative music label. Discover artists, releases, news, and videos.',
        ogTitle: 'darkTunes Music Group',
        ogDescription: 'Alternative music label — artists, releases, news, and videos.',
        impressumCompanyName: 'darkTunes Music Group',
        impressumLegalForm: '',
        impressumRepresentative: '',
        impressumAddress: '',
        impressumVatId: '',
        impressumRegisterCourt: '',
        impressumRegisterNumber: '',
        impressumPhone: '',
        impressumEmail: 'info@darktunes.com',
        datenschutzContent: '',
        consentPlaceholderUrl: '',
        noiseOpacity: 0.04,
        crtScanlinesEnabled: true,
        vignetteIntensity: 0.5,
        shopifyStoreUrl: '',
        youtubeChannelId: '',
        carouselAutoplayMs: 0,
        featureToggles: { promoPool: true, sosStatements: true, editorTools: true },
      }),
    ),
    getLocale(),
  ])

  const dict = await getDictionary(locale)

  return (
    <HomePageContent
      releases={releases}
      artists={artists}
      news={news}
      videos={videos}
      concerts={concerts}
      siteSettings={siteSettings}
      dict={dict}
      locale={locale}
    />
  )
}
