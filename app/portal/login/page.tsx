/**
 * app/portal/login/page.tsx — Artist Portal login page (Server Component)
 *
 * Renders the PortalLoginForm client component.
 * If the user is already authenticated, middleware.ts redirects them to /portal
 * before this page ever renders.
 */

export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { PortalLoginForm } from '../_components/PortalLoginForm'

export const metadata: Metadata = {
  title: 'Artist Portal — darkTunes Music Group',
  robots: { index: false, follow: false },
}

export default async function PortalLoginPage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  return <PortalLoginForm dict={dict.portal} />
}
