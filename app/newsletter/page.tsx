/**
 * app/newsletter/page.tsx
 *
 * Dedicated newsletter sign-up page.
 * The header CTA button links here; the page renders the NewsletterSection
 * component so users can subscribe without navigating to the homepage first.
 */

import type { Metadata } from 'next'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { NewsletterSection } from '@/components/NewsletterSection'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Newsletter – darkTunes Music Group',
  description:
    'Subscribe to the darkTunes newsletter and stay in the loop — new releases, tour dates, and exclusive content delivered to your inbox.',
}

export default async function NewsletterPage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  return (
    <main id="main-content" className="min-h-screen bg-background flex flex-col">
      <div className="pt-28 pb-6 px-4 text-center">
        <Link
          href="/"
          className="inline-block text-sm text-muted-foreground underline hover:text-accent transition-colors"
        >
          {dict.pages.backToHome}
        </Link>
      </div>
      <NewsletterSection dict={dict.newsletter} />
    </main>
  )
}
