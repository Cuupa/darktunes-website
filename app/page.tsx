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
import { HomePageContent } from './_components/HomePageContent'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getReleases } from '@/lib/api/releases'
import { getArtists } from '@/lib/api/artists'
import { getNewsPosts } from '@/lib/api/news'
import { getVideos } from '@/lib/api/videos'
import { getSiteSettings } from '@/lib/api/siteSettings'
import type { Release, Artist, NewsPost, Video, SiteSettings } from '@/types'

// ---------------------------------------------------------------------------
// Cached data-fetching helpers
// Next.js 15: explicit caching with tags for on-demand revalidation
// ---------------------------------------------------------------------------

const getCachedReleases = unstable_cache(
  async (): Promise<Release[]> => {
    const client = await createServerSupabaseClient()
    return getReleases(client)
  },
  ['releases'],
  { revalidate: 60, tags: ['releases'] },
)

const getCachedArtists = unstable_cache(
  async (): Promise<Artist[]> => {
    const client = await createServerSupabaseClient()
    return getArtists(client)
  },
  ['artists'],
  { revalidate: 60, tags: ['artists'] },
)

const getCachedNews = unstable_cache(
  async (): Promise<NewsPost[]> => {
    const client = await createServerSupabaseClient()
    return getNewsPosts(client)
  },
  ['news'],
  { revalidate: 60, tags: ['news'] },
)

const getCachedVideos = unstable_cache(
  async (): Promise<Video[]> => {
    const client = await createServerSupabaseClient()
    return getVideos(client)
  },
  ['videos'],
  { revalidate: 60, tags: ['videos'] },
)

const getCachedSiteSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    const client = await createServerSupabaseClient()
    return getSiteSettings(client)
  },
  ['site-settings'],
  { revalidate: 60, tags: ['site-settings'] },
)

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function HomePage() {
  // Fetch all data in parallel on the server
  const [releases, artists, news, videos, siteSettings] = await Promise.all([
    getCachedReleases().catch(() => [] as Release[]),
    getCachedArtists().catch(() => [] as Artist[]),
    getCachedNews().catch(() => [] as NewsPost[]),
    getCachedVideos().catch(() => [] as Video[]),
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
      }),
    ),
  ])

  return (
    <HomePageContent
      releases={releases}
      artists={artists}
      news={news}
      videos={videos}
      siteSettings={siteSettings}
    />
  )
}
