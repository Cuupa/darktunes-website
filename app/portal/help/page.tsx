/**
 * app/portal/help/page.tsx — Help & FAQ (Server Component)
 */

import { getCachedPortalFaq } from '@/lib/portal/getCachedPortalFaq'
import { HelpPanel } from './_components/HelpPanel'

export default async function HelpPage() {
  const faqTree = await getCachedPortalFaq()
  return <HelpPanel faqTree={faqTree} />
}