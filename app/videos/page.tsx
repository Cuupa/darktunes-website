/**
 * app/videos/page.tsx — All Videos page with search (RSC)
 *
 * Full-page video browser with client-side search by title and artist.
 * Linked from the homepage Videos section when videosLinkToPage is enabled.
 */

import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getPublicVideos } from '@/lib/api/videos'
import { getSiteSettings } from '@/lib/api/siteSettings'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { unstable_cache } from 'next/cache'
import { VideosPageContent } from './_components/VideosPageContent'

export const revalidate = 60

function createPublicSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
  )
}

const getCachedVideos = unstable_cache(
  async () => getPublicVideos(createPublicSupabaseClient()),
  ['all-videos-page'],
  { revalidate: 60, tags: ['videos'] },
)

const getCachedSiteSettings = unstable_cache(
  async () => getSiteSettings(createPublicSupabaseClient()),
  ['site-settings-videos-page'],
  { revalidate: 60, tags: ['site-settings'] },
)

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getCachedSiteSettings().catch(() => null)
  const labelName = settings?.labelName ?? 'darkTunes Music Group'
  return {
    title: `Videos — ${labelName}`,
    description: `Watch all music videos from ${labelName}`,
  }
}

export default async function VideosPage() {
  const locale = await getLocale()
  const [videos, dict, settings] = await Promise.all([
    getCachedVideos().catch(() => []),
    getDictionary(locale),
    getCachedSiteSettings().catch(() => null),
  ])

  return (
    <VideosPageContent
      videos={videos}
      dict={dict.videos}
      consentDict={dict.consent}
      locale={locale}
      placeholderUrl={settings?.consentPlaceholderUrl || undefined}
      videosPerPage={settings?.videosPerPage ?? 9}
    />
  )
}
