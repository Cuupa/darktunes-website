/**
 * app/portal/help/page.tsx — Help & FAQ (Server Component)
 *
 * Fully static page — no API calls needed.
 */

import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { HelpPanel } from './_components/HelpPanel'

export default async function HelpPage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  return <HelpPanel dict={dict.portal} />
}
