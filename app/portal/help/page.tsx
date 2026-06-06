/**
 * app/portal/help/page.tsx — Help & FAQ (Server Component)
 *
 * Fully static page — no API calls needed.
 */

import { HelpPanel } from './_components/HelpPanel'
import { getPortalDictionary } from '@/i18n/getDictionary'

export default async function HelpPage() {
  const dict = await getPortalDictionary()
  return <HelpPanel dict={dict.portal} />
}
