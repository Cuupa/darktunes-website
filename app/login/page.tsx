export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { CentralLoginForm } from './_components/CentralLoginForm'

export const metadata: Metadata = {
  title: 'Login — darkTunes Music Group',
  robots: { index: false, follow: false },
}

export default async function LoginPage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  return <CentralLoginForm dict={dict.portal} />
}
