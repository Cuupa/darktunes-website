/**
 * app/releases/page.tsx — Public releases listing page (RSC)
 *
 * Shows all visible, non-promo releases as a searchable, filterable grid.
 * Each card links to /releases/[id].
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { getCachedPublicReleases } from '@/lib/cache/publicQueries'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { ReleasesPageContent } from './_components/ReleasesPageContent'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Releases — darkTunes Music Group',
  description: 'Browse all releases from darkTunes Music Group artists.',
}

export default async function ReleasesPage() {
  const locale = await getLocale()
  const [releases, dict] = await Promise.all([
    getCachedPublicReleases(),
    getDictionary(locale),
  ])

  return (
    <main id="main-content" className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 lg:px-16 pt-36 pb-24">
        <div className="mb-12">
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-accent font-mono uppercase tracking-widest mb-6 inline-block"
          >
            {dict.pages.backToHome}
          </Link>
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mt-2">{dict.releases.heading}</h1>
          <p className="text-xl text-muted-foreground font-serif mt-3">{dict.releases.subheading}</p>
        </div>
        <ReleasesPageContent releases={releases} dict={dict.releases} />
      </div>
    </main>
  )
}
