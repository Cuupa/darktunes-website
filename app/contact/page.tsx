/**
 * app/contact/page.tsx — Contact page [RSC]
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowSquareOut } from '@phosphor-icons/react/dist/ssr'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { getCachedSiteSettings } from '@/lib/cache/publicQueries'
import { ContactForm } from './_components/ContactForm'

export const metadata: Metadata = {
  title: 'Contact — darkTunes Music Group',
  description: 'Get in touch with darkTunes Music Group.',
}

const SUBMITHUB_URL_FALLBACK = 'https://www.submithub.com/playlister/darktunes-music-group'

export default async function ContactPage() {
  const [locale, settings] = await Promise.all([getLocale(), getCachedSiteSettings().catch(() => null)])
  const dict = await getDictionary(locale)
  const c = dict.contact
  const submitHubUrl = settings?.submitHubUrl || SUBMITHUB_URL_FALLBACK

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 lg:px-8 pt-36 pb-24 max-w-4xl">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-accent transition-colors mb-8 inline-block"
        >
          {dict.pages.backToHome}
        </Link>

        <div className="mb-12">
          <h1 className="text-5xl lg:text-6xl font-bold mb-4 tracking-tight uppercase">
            {c.heading}
          </h1>
          <p className="text-xl text-muted-foreground font-serif">{c.subheading}</p>
        </div>

        {/* Contact form */}
        <section className="mb-14 rounded-xl border border-border bg-card/40 p-8">
          <ContactForm dict={c} locale={locale} contactTopics={settings?.contactTopics ?? []} />
        </section>

        {/* Submit Music section */}
        <section className="rounded-xl border border-primary/30 bg-card/60 p-8 space-y-4">
          <h2 className="text-2xl font-bold uppercase tracking-wider">{c.submitMusicHeading}</h2>
          <p className="text-muted-foreground font-serif leading-relaxed">
            {c.submitMusicDescription}
          </p>
          <a
            href={submitHubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-white font-bold uppercase tracking-wider hover:bg-primary/90 transition-all hover:scale-105"
          >
            {c.submitMusicButton}
            <ArrowSquareOut size={18} weight="bold" />
          </a>
        </section>
      </div>
    </div>
  )
}
