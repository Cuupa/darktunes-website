import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { Providers } from './_components/Providers'
import { getSiteSettings } from '@/lib/api/siteSettings'
import { VisualEffectsOverlay } from '@/components/VisualEffectsOverlay'
import { unstable_cache } from 'next/cache'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import './globals.css'

/**
 * Cookie-free Supabase client — safe to use inside unstable_cache.
 *
 * In Next.js 15, dynamic APIs like cookies() cannot be called inside
 * unstable_cache callbacks.  Site settings are publicly readable (RLS: TRUE),
 * so the anon key without a session cookie is sufficient.
 */
function createPublicSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
  )
}

const getCachedSiteSettings = unstable_cache(
  async () => {
    return getSiteSettings(createPublicSupabaseClient())
  },
  ['site-settings'],
  { revalidate: 60, tags: ['site-settings'] },
)

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getCachedSiteSettings().catch(() => null)
  const title = settings?.seoTitle ?? 'darkTunes Music Group'
  const description =
    settings?.seoDescription ??
    'Official website for darkTunes Music Group — an alternative music label. Discover artists, releases, news, and videos.'
  const ogTitle = settings?.ogTitle ?? title
  const ogDescription = settings?.ogDescription ?? description
  const faviconUrl = settings?.faviconUrl || '/icons/icon-192.png'

  return {
    title,
    description,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: 'website',
    },
    icons: {
      icon: [
        { url: '/favicon.svg', type: 'image/svg+xml' },
        { url: faviconUrl },
      ],
      shortcut: '/favicon.svg',
      apple: faviconUrl,
    },
  }
}

/**
 * Root Server Component layout — no "use client" here.
 * Providers wraps the tree with client-only concerns (Lenis, Toaster, ErrorBoundary).
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const settings = await getCachedSiteSettings().catch(() => null)

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oxanium:wght@200..800&family=Roboto+Slab:wght@100..900&family=JetBrains+Mono:wght@100..800&display=fallback"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {/* PWA meta — prevents white flash and styles the status bar */}
        <meta name="theme-color" content="#101010" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="darkTunes" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-background text-foreground antialiased" suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:bg-background focus:text-foreground focus:px-4 focus:py-2 focus:rounded-md focus:border focus:border-accent focus:outline-none"
        >
          Skip to main content
        </a>
        <VisualEffectsOverlay
          noiseOpacity={settings?.noiseOpacity ?? 0.03}
          crtScanlinesEnabled={settings?.crtScanlinesEnabled ?? true}
          vignetteIntensity={settings?.vignetteIntensity ?? 0.5}
        />
        <Providers consentDict={dict.consent}>{children}</Providers>
      </body>
    </html>
  )
}
