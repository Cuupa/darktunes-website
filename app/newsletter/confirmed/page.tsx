/**
 * app/newsletter/confirmed/page.tsx
 *
 * Newsletter Double Opt-In confirmation landing page.
 *
 * Shown after the user clicks the verification link in their confirmation email.
 *   - Without ?error=1 → success (subscription confirmed).
 *   - With    ?error=1 → failure (invalid / expired token).
 */

import Link from 'next/link'
import { CheckCircle, XCircle } from '@phosphor-icons/react/dist/ssr'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Newsletter | darkTunes',
  robots: 'noindex, nofollow',
}

interface PageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function NewsletterConfirmedPage({ searchParams }: PageProps) {
  const params = await searchParams
  const isError = params.error === '1'
  const [tNewsletter, tPages] = await Promise.all([
    getTranslations('newsletter'),
    getTranslations('pages'),
  ])

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="text-center max-w-md space-y-6">
        {isError ? (
          <>
            <XCircle size={64} weight="fill" className="text-destructive mx-auto" />
            <h1 className="text-3xl font-bold tracking-tight uppercase">{tNewsletter('confirmErrorTitle')}</h1>
            <p className="text-muted-foreground">{tNewsletter('confirmErrorMessage')}</p>
          </>
        ) : (
          <>
            <CheckCircle size={64} weight="fill" className="text-primary mx-auto" />
            <h1 className="text-3xl font-bold tracking-tight uppercase">{tNewsletter('confirmSuccessTitle')}</h1>
            <p className="text-muted-foreground">{tNewsletter('confirmSuccessMessage')}</p>
          </>
        )}
        <Link
          href="/"
          className="inline-block mt-4 text-sm text-primary underline hover:text-primary/80 transition-colors"
        >
          {tPages('backToHome')}
        </Link>
      </div>
    </main>
  )
}