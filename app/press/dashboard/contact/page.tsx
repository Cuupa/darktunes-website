export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { ContactClient } from './_components/ContactClient'

export default async function PressContactPage() {
  const locale = await getLocale()
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const dict = await getDictionary(locale)
  return <ContactClient dict={dict.pressContact} userId={user.id} userEmail={user.email ?? ''} />
}
