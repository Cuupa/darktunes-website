export const dynamic = 'force-dynamic'

import { getTranslations } from 'next-intl/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SettingsPanel } from './_components/SettingsPanel'

export default async function PortalSettingsPage() {
  const t = await getTranslations('portal')


  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return null

  return <SettingsPanel email={user.email} />
}
