import type { Metadata } from 'next'
import { Providers } from './_components/Providers'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSiteSettings } from '@/lib/api/siteSettings'
import { VisualEffectsOverlay } from '@/components/VisualEffectsOverlay'
import { unstable_cache } from 'next/cache'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import './globals.css'

const getCachedSiteSettings = unstable_cache(
  async () => {
    const client = await createServerSupabaseClient()
    return getSiteSettings(client)
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

  return {
    title,
    description,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: 'website',
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
          href="https://fonts.googleapis.com/css2?family=Oxanium:wght@200..800&family=Roboto+Slab:wght@100..900&family=JetBrains+Mono:wght@100..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-foreground antialiased">
        <VisualEffectsOverlay
          noiseOpacity={settings?.noiseOpacity ?? 0.04}
          crtScanlinesEnabled={settings?.crtScanlinesEnabled ?? true}
          vignetteIntensity={settings?.vignetteIntensity ?? 0.5}
        />
        <Providers consentDict={dict.consent}>{children}</Providers>
      </body>
    </html>
  )
}
