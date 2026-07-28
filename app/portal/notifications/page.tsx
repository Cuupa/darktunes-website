import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PortalNotificationsClient } from './_components/PortalNotificationsClient'

export default async function PortalNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ artistId?: string }>
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const artistId = params.artistId ?? null

  return (
    <div className="p-6">
      <PortalNotificationsClient userId={user.id} artistId={artistId} />
    </div>
  )
}
