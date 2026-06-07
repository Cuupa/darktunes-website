/**
 * app/_components/SiteFooter.tsx — Server Component wrapper for the Footer.
 *
 * Fetches site settings and dictionary server-side and renders the global
 * Footer so it appears on every page via app/layout.tsx.
 */

import { Footer } from '@/components/Footer'
import { getCachedSiteSettings } from '@/lib/cache/publicQueries'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { SITE_SETTINGS_DEFAULTS } from '@/lib/api/siteSettings'

export async function SiteFooter() {
  const locale = await getLocale()
  const [settings, dict] = await Promise.all([
    getCachedSiteSettings().catch(() => null),
    getDictionary(locale),
  ])

  return <Footer siteSettings={settings ?? SITE_SETTINGS_DEFAULTS} dict={dict.footer} />
}
