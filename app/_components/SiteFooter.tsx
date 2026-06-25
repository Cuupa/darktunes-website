/**
 * app/_components/SiteFooter.tsx — Server Component wrapper for the Footer.
 *
 * Fetches site settings server-side and renders the global
 * Footer so it appears on every page via app/layout.tsx.
 */

import { Footer } from '@/components/Footer'
import { getCachedSiteSettings } from '@/lib/cache/publicQueries'
import { SITE_SETTINGS_DEFAULTS } from '@/lib/api/siteSettings'

export async function SiteFooter() {
  const settings = await getCachedSiteSettings().catch(() => null)

  return <Footer siteSettings={settings ?? SITE_SETTINGS_DEFAULTS} />
}