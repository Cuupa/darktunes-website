import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminPageShell } from '../../_components/AdminPageShell'
import { AdminNotificationPreferencesClient } from './_components/AdminNotificationPreferencesClient'

export default async function AdminNotificationPreferencesPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/admin')

  const t = await getTranslations('admin.notifications')

  return (
    <AdminPageShell title={t('preferencesTitle')} description={t('preferencesDescription')}>
      <AdminNotificationPreferencesClient userId={user.id} />
    </AdminPageShell>
  )
}
