export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SettingsPanel } from './_components/SettingsPanel'

export default async function PortalSettingsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return null

  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  return <SettingsPanel email={user.email} displayName={profile?.full_name ?? ''} />
}
