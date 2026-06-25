export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getDownloadHistory } from '@/lib/api/journalistDownloads'
import { getJournalistApplicationByUserId } from '@/lib/api/journalistApplications'
import { ProfileClient } from './_components/ProfileClient'

export default async function PressProfilePage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [history, application] = await Promise.all([
    getDownloadHistory(supabase, user.id).catch(() => []),
    getJournalistApplicationByUserId(supabase, user.id).catch(() => null),
  ])

  return (
    <ProfileClient
      user={{ id: user.id, email: user.email ?? '' }}
      downloadCount={history.length}
      application={application}
    />
  )
}