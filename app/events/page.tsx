/**
 * app/events/page.tsx — Public events listing page (RSC)
 *
 * Shows all upcoming concerts as a filterable list.
 * Each event card shows date, venue, and a ticket link.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { getCachedPublicConcerts } from '@/lib/cache/publicQueries'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { EventsPageContent } from './_components/EventsPageContent'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Events — darkTunes Music Group',
  description: 'Browse all upcoming live events from darkTunes Music Group artists.',
}

export default async function EventsPage() {
  const locale = await getLocale()
  const [concerts, dict] = await Promise.all([
    getCachedPublicConcerts(),
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
            ← {dict.pages.backToHome}
          </Link>
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mt-2">{dict.concerts.heading}</h1>
          <p className="text-xl text-muted-foreground font-serif mt-3">{dict.concerts.subheading}</p>
        </div>
        <EventsPageContent concerts={concerts} dict={dict.concerts} locale={locale} />
      </div>
    </main>
  )
}
