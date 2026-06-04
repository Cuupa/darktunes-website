export const dynamic = 'force-dynamic'

/**
 * app/account/privacy/page.tsx
 *
 * Self-service GDPR controls for the authenticated user:
 *  - Export all personal data as JSON
 *  - Link to the account deletion page
 *
 * Accessible to every authenticated user.
 */

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PrivacyClient } from './_components/PrivacyClient'

export default async function AccountPrivacyPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/portal/login')

  return <PrivacyClient email={user.email ?? ''} />
}
