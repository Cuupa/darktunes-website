/**
 * app/_components/SiteHeader.tsx — Server Component wrapper for the Header.
 *
 * Fetches the site settings and dictionary server-side and passes them to the
 * client Header component. This allows the Header to be rendered in the root
 * layout so it appears on every page without duplicating data-fetching logic.
 */

import { Header } from '@/components/Header'
import { getCachedSiteSettings } from '@/lib/cache/publicQueries'
import { getDictionary, getLocale } from '@/i18n/getDictionary'

export async function SiteHeader() {
  const locale = await getLocale()
  const [settings, dict] = await Promise.all([
    getCachedSiteSettings().catch(() => null),
    getDictionary(locale),
  ])

  return (
    <Header
      dict={dict.navigation}
      locale={locale}
      logoUrl={settings?.logoUrl}
      sectionOrder={settings?.homepageSectionOrder}
    />
  )
}
