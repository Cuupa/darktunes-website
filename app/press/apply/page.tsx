import type { Metadata } from 'next'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { ApplyForm } from './_components/ApplyForm'

export const metadata: Metadata = {
  title: 'Apply for Press Access — darkTunes Music Group',
  robots: { index: false, follow: false },
}

export default async function PressApplyPage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  return <ApplyForm dict={dict.apply} />
}
