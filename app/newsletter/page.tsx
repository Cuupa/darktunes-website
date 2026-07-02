/**
 * app/newsletter/page.tsx
 *
 * Dedicated newsletter sign-up page.
 * The header CTA button links here; the page renders the NewsletterSection
 * component so users can subscribe without navigating to the homepage first.
 */

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { NewsletterSection } from '@/components/NewsletterSection'
import Link from 'next/link'
import { getMetadataBrand, pageTitle } from '@/lib/seo/metadata'

export async function generateMetadata(): Promise<Metadata> {
  const { labelName, labelShortName } = await getMetadataBrand()
  return {
    title: pageTitle('Newsletter', labelName),
    description: `Subscribe to the ${labelShortName} newsletter and stay in the loop — new releases, tour dates, and exclusive content delivered to your inbox.`,
  }
}

export default async function NewsletterPage() {
  const tPages = await getTranslations('pages')

  return (
    <main id="main-content" className="min-h-screen bg-background flex flex-col">
      <div className="pt-28 pb-6 px-4 text-center">
        <Link
          href="/"
          className="inline-block text-sm text-muted-foreground underline hover:text-accent transition-colors"
        >
          {tPages('backToHome')}
        </Link>
      </div>
      <NewsletterSection />
    </main>
  )
}