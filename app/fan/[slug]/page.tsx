import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { createPublicSupabaseClient } from '@/lib/supabase/publicClient'
import { getPublishedFanPageBySlug } from '@/lib/api/publicFanPage'
import { getArtistBySlug } from '@/lib/api/artists'
import { getReleasesByArtistId } from '@/lib/api/releases'
import { getConcertsByArtistId } from '@/lib/api/concerts'
import { getVideosByArtistId } from '@/lib/api/videos'
import { FanPagePublicView } from './_components/FanPagePublicView'

interface Props {
  params: Promise<{ slug: string }>
}

export const revalidate = 60
export const dynamicParams = true

function makeGetFanPageData(slug: string) {
  return unstable_cache(
    async () => {
      const client = createPublicSupabaseClient()
      const page = await getPublishedFanPageBySlug(client, slug)
      if (!page) return null

      const artist = await getArtistBySlug(client, slug)
      if (!artist) return null

      const [releases, concerts, videos] = await Promise.all([
        getReleasesByArtistId(client, artist.id),
        getConcertsByArtistId(client, artist.id),
        getVideosByArtistId(client, artist.id),
      ])

      return { page, artist, releases, concerts, videos }
    },
    [`fan-page-${slug}`],
    { revalidate: 60, tags: ['fan-pages', `fan-page-${slug}`] },
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await makeGetFanPageData(slug)().catch(() => null)
  if (!data) return { title: 'Fan Page — darkTunes' }

  const title = data.page.seoTitle ?? `${data.page.artistName} — Fan Page`
  const description =
    data.page.seoDescription ?? `Official fan page for ${data.page.artistName} on darkTunes.`

  return { title, description }
}

export default async function FanPageRoute({ params }: Props) {
  const { slug } = await params
  const data = await makeGetFanPageData(slug)().catch(() => null)
  if (!data) notFound()

  return (
    <main id="main-content">
      <FanPagePublicView
        document={data.page.document}
        artist={data.artist}
        releases={data.releases}
        concerts={data.concerts}
        videos={data.videos}
      />
    </main>
  )
}