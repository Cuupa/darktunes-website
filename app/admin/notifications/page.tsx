import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AdminPageShell } from '../_components/AdminPageShell'
import { AdminNotificationsClient } from './_components/AdminNotificationsClient'

export default async function AdminNotificationsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/admin')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile?.role ?? 'admin'
  if (role !== 'admin' && role !== 'editor') redirect('/admin')

  const t = await getTranslations('admin.notifications')

  return (
    <AdminPageShell title={t('centerTitle')} description={t('centerDescription')}>
      <AdminNotificationsClient userId={user.id} role={role} />
    </AdminPageShell>
  )
}
