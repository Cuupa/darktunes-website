export const dynamic = 'force-dynamic'

import { getPortalDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SettingsPanel } from './_components/SettingsPanel'

export default async function PortalSettingsPage() {
  const locale = await getLocale()
  const dict = await getPortalDictionary()

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return null

  return <SettingsPanel dict={dict.portal} email={user.email} locale={locale} />
}
