export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { PressLoginForm } from './_components/PressLoginForm'

export const metadata: Metadata = {
  title: 'Press Login — darkTunes Music Group',
  robots: { index: false, follow: false },
}

export default async function PressLoginPage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  return <PressLoginForm dict={dict.pressLogin} />
}
