/**
 * app/not-found.tsx — Custom 404 page [RSC]
 *
 * Lightweight static React Server Component with zero data fetching.
 * The root layout already handles getCachedSiteSettings() and i18n;
 * this page intentionally adds no further overhead.
 */

import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '404 – Page not found',
  robots: { index: false },
}

export default function NotFound() {
  return (
    <div id="main-content" className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 lg:px-8 pt-36 pb-24 max-w-3xl">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-accent transition-colors mb-8 inline-block focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          ← Back to home
        </Link>

        <div className="mb-12">
          <p className="text-sm font-semibold tracking-widest text-muted-foreground uppercase mb-4">
            Error 404
          </p>
          <h1 className="text-5xl lg:text-6xl font-bold mb-4 tracking-tight uppercase">
            Page not found
          </h1>
          <p className="text-xl text-muted-foreground">
            Diese Seite existiert nicht oder wurde verschoben.
          </p>
        </div>
      </div>
    </div>
  )
}
