/**
 * app/promo-pool/login/page.tsx — Promo Pool login page (Server Component)
 *
 * If the user is already authenticated, middleware redirects to /promo-pool.
 * This page renders: a login form + a journalist application form (for new users).
 */

export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { PromoLoginClient } from './_components/PromoLoginClient'

export const metadata: Metadata = {
  title: 'Promo Pool Login — darkTunes Music Group',
  robots: { index: false, follow: false },
}

export default async function PromoLoginPage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  return <PromoLoginClient dict={dict.promoPool} />
}
