export const dynamic = 'force-dynamic'

/**
 * app/account/delete/page.tsx
 *
 * Multi-step account deletion confirmation page.
 * Only accessible to authenticated, non-admin users.
 */

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { DeleteAccountClient } from './_components/DeleteAccountClient'

export default async function DeleteAccountPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Admins are blocked from self-service deletion
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') redirect('/account/privacy?error=admin_no_self_delete')

  return <DeleteAccountClient email={user.email ?? ''} />
}
