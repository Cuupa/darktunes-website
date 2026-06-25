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
import type { Metadata } from 'next'
import { HomePageContent } from './_components/HomePageContent'
import { getSiteSettings } from '@/lib/api/siteSettings'

import {
  getCachedPublicReleases,
  getCachedPublicNews,
  getCachedPublicVideos,
  getCachedPublicConcerts,
  getCachedPublicArtists,
} from '@/lib/cache/publicQueries'
import { createPublicSupabaseClient } from '@/lib/supabase/publicClient'
import type { SiteSettings } from '@/types'
import {
  buildOrganizationSchema,
  buildWebSiteSchema,
  serializeJsonLd,
} from '@/lib/seo/jsonld'

/**
 * Homepage-specific metadata. Inherits base title/description/OG from the root
 * layout's generateMetadata(), and adds homepage-specific Twitter card tags.
 */
export const metadata: Metadata = {
  twitter: {
    card: 'summary_large_image',
  },
}

// ---------------------------------------------------------------------------
// Home page uses a richer fallback for site settings (non-nullable SiteSettings)
// because HomePageContent requires the full object.
// For other RSC pages the nullable getCachedSiteSettings from publicQueries.ts
// is sufficient — those components use optional chaining on every field.
// ---------------------------------------------------------------------------

const getCachedSiteSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    return getSiteSettings(createPublicSupabaseClient()).catch(
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
        heroNewsBadge: '📰 News',
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
        videosPerPage: 9,
        videosLinkToPage: false,
        concertsPerPage: 8,
        concertsLinkToPage: false,
        homepageNewsCount: 3,
        featureToggles: { promoPool: true, editorTools: true },
      }),
    )
  },
  ['site-settings'],
  { revalidate: 60, tags: ['site-settings'] },
)

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function HomePage() {
  // Fetch all data in parallel on the server
  const [releases, news, videos, concerts, siteSettings, artists] = await Promise.all([
    getCachedPublicReleases(),
    getCachedPublicNews(),
    getCachedPublicVideos(),
    getCachedPublicConcerts(),
    getCachedSiteSettings(),
    getCachedPublicArtists(),
  ])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildOrganizationSchema({ siteSettings })) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildWebSiteSchema(siteSettings.labelName)) }}
      />
      <HomePageContent
        releases={releases}
        news={news}
        videos={videos}
        concerts={concerts}
        siteSettings={siteSettings}
        artists={artists}
      />
    </>
  )
}
