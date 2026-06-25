export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ContactClient } from './_components/ContactClient'

export default async function PressContactPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  return <ContactClient userId={user.id} userEmail={user.email ?? ''} />
}