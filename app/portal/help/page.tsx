/**
 * app/portal/help/page.tsx — Help & FAQ (Server Component)
 *
 * Fully static page — no API calls needed.
 */

import { HelpPanel } from './_components/HelpPanel'

export default async function HelpPage() {
  return <HelpPanel />
}
