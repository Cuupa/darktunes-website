/**
 * app/portal/accept-invite/page.tsx — Accept artist invite (Server Component)
 *
 * Landing page for the Supabase invite magic link.
 * Supabase redirects the artist here after they click the invite email with
 * a `#access_token=...&type=invite` hash fragment.  Because hash fragments are
 * client-only, all session handling is done in AcceptInviteClient.
 */

export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { AcceptInviteClient } from './_components/AcceptInviteClient'

export const metadata: Metadata = {
  title: 'Activate Your Account — darkTunes Music Group',
  robots: { index: false, follow: false },
}

export default async function AcceptInvitePage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  return <AcceptInviteClient dict={dict.portal} />
}
