import type { Metadata } from 'next'
import { Oxanium, Roboto_Slab, JetBrains_Mono } from 'next/font/google'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { Providers } from './_components/Providers'
import { getSiteSettings } from '@/lib/api/siteSettings'
import { VisualEffectsOverlay } from '@/components/VisualEffectsOverlay'
import { unstable_cache } from 'next/cache'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import './globals.css'

const oxanium = Oxanium({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
})

const robotoSlab = Roboto_Slab({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-serif',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800'],
  variable: '--font-mono',
  display: 'swap',
})

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
        { url: faviconUrl },
        { url: '/favicon.svg', type: 'image/svg+xml' },
      ],
      shortcut: faviconUrl,
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
    <html lang={locale} className={`${oxanium.variable} ${robotoSlab.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
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
