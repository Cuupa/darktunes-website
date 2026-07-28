import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PortalNotificationPreferencesClient } from './_components/PortalNotificationPreferencesClient'

export default async function PortalNotificationPreferencesPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="p-6">
      <PortalNotificationPreferencesClient userId={user.id} />
    </div>
  )
}
