/**
 * app/news/page.tsx — News list page [RSC]
 */

import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getPublicNewsPosts } from '@/lib/api/news'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { NewsList } from './_components/NewsList'

function createPublicSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
  )
}

const getCachedPosts = unstable_cache(
  async () => {
    return getPublicNewsPosts(createPublicSupabaseClient())
  },
  ['news-posts'],
  { revalidate: 60, tags: ['news'] },
)

export const metadata: Metadata = {
  title: 'News — darkTunes Music Group',
  description: 'Latest news and updates from darkTunes Music Group.',
}

export default async function NewsPage() {
  const locale = await getLocale()
  const [posts, dict] = await Promise.all([
    getCachedPosts().catch(() => []),
    getDictionary(locale),
  ])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 lg:px-8 py-24 max-w-7xl">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-accent transition-colors mb-8 inline-block"
        >
          {dict.pages.backToHome}
        </Link>

        <div className="mb-12">
          <h1 className="text-5xl lg:text-6xl font-bold mb-4 tracking-tight uppercase">
            {dict.newsPage.heading}
          </h1>
          <p className="text-xl text-muted-foreground font-serif">{dict.newsPage.subheading}</p>
        </div>

        <NewsList posts={posts} dict={dict.newsPage} />
      </div>
    </div>
  )
}
