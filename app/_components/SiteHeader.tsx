/**
 * app/_components/SiteHeader.tsx — Server Component wrapper for the Header.
 *
 * Fetches the site settings server-side and passes them to the
 * client Header component. This allows the Header to be rendered in the root
 * layout so it appears on every page without duplicating data-fetching logic.
 */

import { Header } from '@/components/Header'
import { getCachedSiteSettings } from '@/lib/cache/publicQueries'

export async function SiteHeader() {
  const settings = await getCachedSiteSettings().catch(() => null)

  return (
    <Header
      logoUrl={settings?.logoUrl}
      labelName={settings?.labelName}
      sectionOrder={settings?.homepageSectionOrder}
      showAbout={settings?.showAboutInHeader ?? true}
      aboutNavLabel={settings?.aboutNavLabel || undefined}
    />
  )
}