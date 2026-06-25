/**
 * app/videos/page.tsx — All Videos page with search (RSC)
 *
 * Full-page video browser with client-side search by title and artist.
 * Linked from the homepage Videos section when videosLinkToPage is enabled.
 */

import type { Metadata } from 'next'
import { getCachedPublicVideos, getCachedSiteSettings } from '@/lib/cache/publicQueries'
import { VideosPageContent } from './_components/VideosPageContent'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getCachedSiteSettings().catch(() => null)
  const labelName = settings?.labelName ?? 'darkTunes Music Group'
  return {
    title: `Videos — ${labelName}`,
    description: `Watch all music videos from ${labelName}`,
  }
}

export default async function VideosPage() {
  const [videos, settings] = await Promise.all([
    getCachedPublicVideos(),
    getCachedSiteSettings(),
  ])

  return (
    <VideosPageContent
      videos={videos}
      placeholderUrl={settings?.consentPlaceholderUrl || undefined}
      videosPerPage={settings?.videosPerPage ?? 9}
    />
  )
}