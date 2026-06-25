import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getSiteSettings } from '@/lib/api/siteSettings'
import { getPublicArtists } from '@/lib/api/artists'
import { getPublicNewsPosts } from '@/lib/api/news'
import { AboutContent } from './_components/AboutContent'

function createPublicSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
  )
}

const getCachedAboutData = unstable_cache(
  async () => {
    const client = createPublicSupabaseClient()
    const [siteSettings, artists, news] = await Promise.all([
      getSiteSettings(client),
      getPublicArtists(client),
      getPublicNewsPosts(client),
    ])
    return { siteSettings, artists, news }
  },
  ['about-page'],
  { revalidate: 60, tags: ['artists', 'news'] },
)

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('about')
  return {
    title: `${t('heading')} | darkTunes Music Group`,
    description: t('subheading'),
  }
}

export default async function AboutPage() {
  const { siteSettings, artists, news } = await getCachedAboutData().catch(() => ({
    siteSettings: null,
    artists: [],
    news: [],
  }))

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <AboutContent siteSettings={siteSettings} artists={artists} news={news} />
    </main>
  )
}