import type { Metadata } from 'next'
import { Oxanium, Roboto_Slab, JetBrains_Mono } from 'next/font/google'
import { Providers } from './_components/Providers'
import { NavHidingWrapper } from './_components/ConditionalSiteHeader'
import { SiteHeader } from './_components/SiteHeader'
import { VisualEffectsOverlay } from '@/components/VisualEffectsOverlay'
import { ThemeStyleInjector } from './_components/ThemeStyleInjector'
import { getCachedSiteSettings } from '@/lib/cache/publicQueries'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { WebVitals } from './web-vitals'
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

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getCachedSiteSettings().catch(() => null)
  const title = settings?.seoTitle ?? 'darkTunes Music Group'
  const description =
    settings?.seoDescription ??
    'Official website for darkTunes Music Group — an alternative music label. Discover artists, releases, news, and videos.'
  const ogTitle = settings?.ogTitle ?? title
  const ogDescription = settings?.ogDescription ?? description
  const customFaviconUrl = settings?.faviconUrl || ''

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
        // SVG favicon — modern browsers prefer this; shows custom "DT" logo
        { url: '/favicon.svg', type: 'image/svg+xml' },
        // Custom favicon from admin settings (PNG, higher specificity via order)
        ...(customFaviconUrl ? [{ url: customFaviconUrl, type: 'image/png' }] : []),
        // ICO fallback for legacy browsers
        { url: '/favicon.ico', sizes: '32x32' },
      ],
      shortcut: '/favicon.ico',
      apple: { url: customFaviconUrl || '/icons/icon-192.png', sizes: '192x192' },
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
        <link rel="apple-touch-icon" href={settings?.faviconUrl || '/icons/icon-192.png'} />
        {/*
          Explicit <link> tags for favicon — these appear after Next.js-generated
          links from generateMetadata() and take precedence in the browser.
          Logo (settings.logoUrl) and favicon (settings.faviconUrl) are independent:
          the logo is used in the header/footer; the favicon in the browser tab.
        */}
        {settings?.faviconUrl ? (
          <link rel="icon" href={settings.faviconUrl} />
        ) : (
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        )}
        {/* Software platform identity — readable by crawlers and Wappalyzer */}
        <meta name="generator" content="Neuroklast & Seifried.dev" />
        {/* Inject admin-configured color token overrides before first paint */}
        <ThemeStyleInjector
          themePrimary={settings?.themePrimary}
          themeSecondary={settings?.themeSecondary}
          themeBackground={settings?.themeBackground}
          themeForeground={settings?.themeForeground}
          themeCard={settings?.themeCard}
          themeMuted={settings?.themeMuted}
          themeAccent={settings?.themeAccent}
          themeBorder={settings?.themeBorder}
          themeGradientHeroFrom={settings?.themeGradientHeroFrom}
          themeGradientHeroTo={settings?.themeGradientHeroTo}
          themeGradientHeroDir={settings?.themeGradientHeroDir}
          themeGradientAccentFrom={settings?.themeGradientAccentFrom}
          themeGradientAccentTo={settings?.themeGradientAccentTo}
          themeGradientAccentDir={settings?.themeGradientAccentDir}
        />
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
        {process.env.NODE_ENV === 'production' ? <WebVitals /> : null}
        <Providers consentDict={dict.consent}>
          <NavHidingWrapper><SiteHeader /></NavHidingWrapper>
          {children}
        </Providers>
      </body>
    </html>
  )
}
