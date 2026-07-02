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
import { AcceptInviteClient } from './_components/AcceptInviteClient'
import { getMetadataBrand, pageTitle } from '@/lib/seo/metadata'

export async function generateMetadata(): Promise<Metadata> {
  const { labelName } = await getMetadataBrand()
  return {
    title: pageTitle('Activate Your Account', labelName),
    robots: { index: false, follow: false },
  }
}

export default async function AcceptInvitePage() {

  return <AcceptInviteClient />
}
