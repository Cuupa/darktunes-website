import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Metadata } from 'next'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
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
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  return {
    title: `${dict.about.heading} | darkTunes Music Group`,
    description: dict.about.subheading,
  }
}

export default async function AboutPage() {
  const [{ siteSettings, artists, news }, locale] = await Promise.all([
    getCachedAboutData().catch(() => ({ siteSettings: null, artists: [], news: [] })),
    getLocale(),
  ])
  const dict = await getDictionary(locale)
  return (
    <main id="main-content" className="min-h-screen bg-background">
      <AboutContent siteSettings={siteSettings} artists={artists} news={news} dict={dict.about} />
    </main>
  )
}
