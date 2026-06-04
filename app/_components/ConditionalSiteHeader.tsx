'use client'

/**
 * app/_components/ConditionalSiteHeader.tsx
 *
 * Renders the public SiteHeader only on the public-facing website.
 * Suppresses it in the admin panel, artist portal, press dashboard,
 * and editor — which all have their own navigation.
 */

import { usePathname } from 'next/navigation'
import { SiteHeader } from './SiteHeader'

/** Path prefixes where the public navbar must NOT be rendered. */
const HIDDEN_PREFIXES = ['/admin', '/portal', '/press/dashboard', '/editor']

export function ConditionalSiteHeader() {
  const pathname = usePathname()
  const hidden = HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))
  if (hidden) return null
  return <SiteHeader />
}
