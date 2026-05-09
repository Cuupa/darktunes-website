/**
 * app/releases/[id]/page.tsx — Release detail page (RSC)
 *
 * Data is fetched server-side. The cover art uses Framer Motion's
 * `layoutId` (matching the one in the Releases grid card) to animate
 * a smooth thumbnail → hero transition on navigation.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getReleaseById } from '@/lib/api/releases'
import { ReleaseDetailContent } from './_components/ReleaseDetailContent'

interface Props {
  params: Promise<{ id: string }>
}

function makeGetRelease(id: string) {
  return unstable_cache(
    async () => {
      const client = await createServerSupabaseClient()
      return getReleaseById(client, id)
    },
    [`release-${id}`],
    { revalidate: 60, tags: ['releases'] },
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
  const release = await makeGetRelease(id)().catch(() => null)
  if (!release) notFound()
  return <ReleaseDetailContent release={release} />
}
