/**
 * app/releases/[id]/page.tsx — Release detail page (RSC)
 *
 * Data is fetched server-side. The cover art uses Framer Motion's
 * `layoutId` (matching the one in the Releases grid card) to animate
 * a smooth thumbnail → hero transition on navigation.
 *
 * ── Data API Waterfall ──────────────────────────────────────────────────────
 * 1. `params.id`        → UUID of the release (from the URL segment)
 * 2. `getReleaseById`   → SELECT * FROM releases WHERE id = ? AND is_visible = TRUE
 *                         (filtered by RLS: anonymous users see visible releases
 *                          whose artist is also visible)
 * 3. Dictionary         → resolved from NEXT_LOCALE cookie / Accept-Language header
 *
 * All steps run in parallel via Promise.all.  The Supabase query uses a
 * cookie-free public client (anon key) so it can be safely cached by
 * unstable_cache without hitting Next.js 15's "cookies() not available inside
 * unstable_cache" restriction.
 * ──────────────────────────────────────────────────────────────────────────
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getReleaseById } from '@/lib/api/releases'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { ReleaseDetailContent } from './_components/ReleaseDetailContent'
import { buildMusicAlbumSchema, serializeJsonLd } from '@/lib/seo/jsonld'

interface Props {
  params: Promise<{ id: string }>
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
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
  )
}

function makeGetRelease(id: string) {
  return unstable_cache(
    async () => {
      const client = createPublicSupabaseClient()
      return getReleaseById(client, id)
    },
    [`release-${id}`],
    // Granular tags: 'releases' invalidates all release lists;
    // `release-${id}` invalidates only this specific release page.
    { revalidate: 60, tags: ['releases', `release-${id}`] },
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const release = await makeGetRelease(id)().catch(() => null)
  if (!release) return { title: 'Release not found — darkTunes' }
  return {
    title: `${release.title} — ${release.artistName} | darkTunes`,
    description: `${release.type.toUpperCase()} by ${release.artistName}, released ${release.releaseDate}`,
    openGraph: {
      title: `${release.title} — ${release.artistName}`,
      images: release.coverArt ? [{ url: release.coverArt }] : [],
      type: 'music.album',
    },
  }
}

export default async function ReleaseDetailPage({ params }: Props) {
  const { id } = await params
  const [release, locale] = await Promise.all([
    makeGetRelease(id)().catch(() => null),
    getLocale(),
  ])
  if (!release) notFound()
  const dict = await getDictionary(locale)
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildMusicAlbumSchema({ release })) }}
      />
      <ReleaseDetailContent release={release} dict={dict.releaseDetail} locale={locale} />
    </>
  )
}
