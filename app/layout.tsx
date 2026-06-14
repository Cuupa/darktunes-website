import type { Metadata, Viewport } from 'next'
import { Oxanium, Roboto_Slab, JetBrains_Mono } from 'next/font/google'
import { Providers } from './_components/Providers'
import { NavHidingWrapper } from './_components/ConditionalSiteHeader'
import { SiteHeader } from './_components/SiteHeader'
import { SiteFooter } from './_components/SiteFooter'
import { VisualEffectsOverlay } from '@/components/VisualEffectsOverlay'
import { ThemeStyleInjector } from './_components/ThemeStyleInjector'
import { ThemeEffectsClient } from './_components/ThemeEffectsClient'
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

function getFaviconMimeType(url: string): string {
  if (url.endsWith('.svg')) return 'image/svg+xml'
  if (url.endsWith('.ico')) return 'image/x-icon'
  if (url.endsWith('.webp')) return 'image/webp'
  return 'image/png'
}

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
      icon: customFaviconUrl
        ? [{ url: customFaviconUrl, type: getFaviconMimeType(customFaviconUrl) }]
        : [
            { url: '/favicon.svg', type: 'image/svg+xml' },
            { url: '/favicon.ico', sizes: '32x32' },
          ],
      shortcut: customFaviconUrl || '/favicon.ico',
      apple: { url: customFaviconUrl || '/icons/icon-192.png', sizes: '192x192' },
    },
  }
}

/**
 * Viewport export — ensures correct mobile rendering on all devices.
 * Next.js App Router does not inject a viewport meta tag by default, so we
 * must export it explicitly.  `width=device-width, initial-scale=1` is the
 * standard mobile-web baseline; `interactive-widget=resizes-visual` prevents
 * the layout from resizing when the virtual keyboard opens on mobile.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-visual',
  themeColor: '#101010',
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
    <html lang={locale} className={`${oxanium.variable} ${robotoSlab.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning data-animation-preset={settings?.themeConfig?.animation?.preset ?? 'slide-up'}>
      <head>
        {/* PWA meta — prevents white flash and styles the status bar */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="darkTunes" />
        <link rel="apple-touch-icon" href={settings?.faviconUrl || '/icons/icon-192.png'} />
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
          themeConfig={settings?.themeConfig}
        />
      </head>
      <body className="bg-background text-foreground antialiased" suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:bg-background focus:text-foreground focus:px-4 focus:py-2 focus:rounded-md focus:border focus:border-accent focus:outline-none"
        >
          Skip to main content
        </a>
        {/* Visual effects and interactive CSS data-attributes are suppressed on
            admin / portal / press / editor routes so the dashboard UI is not
            obscured by noise, vignettes, scanlines, or hover animations. */}
        <NavHidingWrapper>
          <VisualEffectsOverlay
            noiseOpacity={settings?.noiseOpacity ?? 0.03}
            crtScanlinesEnabled={settings?.crtScanlinesEnabled ?? true}
            vignetteIntensity={settings?.vignetteIntensity ?? 0.5}
            effects={settings?.themeConfig?.effects}
          />
          <ThemeEffectsClient effects={settings?.themeConfig?.effects} />
        </NavHidingWrapper>
        {process.env.NODE_ENV === 'production' ? <WebVitals /> : null}
        <Providers consentDict={dict.consent}>
          <NavHidingWrapper><SiteHeader /></NavHidingWrapper>
          {children}
          <NavHidingWrapper><SiteFooter /></NavHidingWrapper>
        </Providers>
      </body>
    </html>
  )
}
