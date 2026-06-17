/**
 * app/news/page.tsx — News list page [RSC]
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { getCachedPublicNews } from '@/lib/cache/publicQueries'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { NewsList } from './_components/NewsList'

export const metadata: Metadata = {
  title: 'News — darkTunes Music Group',
  description: 'Latest news and updates from darkTunes Music Group.',
}

export default async function NewsPage() {
  const locale = await getLocale()
  const [posts, dict] = await Promise.all([
    getCachedPublicNews(),
    getDictionary(locale),
  ])

  return (
    <div id="main-content" className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 lg:px-8 pt-36 pb-24 max-w-7xl">
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
          <p className="text-xl text-muted-foreground">{dict.newsPage.subheading}</p>
        </div>

        <NewsList posts={posts} dict={dict.newsPage} />
      </div>
    </div>
  )
}
