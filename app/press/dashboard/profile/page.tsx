export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { getDownloadHistory } from '@/lib/api/journalistDownloads'
import { getJournalistApplicationByUserId } from '@/lib/api/journalistApplications'
import { ProfileClient } from './_components/ProfileClient'

export default async function PressProfilePage() {
  const locale = await getLocale()
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [history, application, dict] = await Promise.all([
    getDownloadHistory(supabase, user.id).catch(() => []),
    getJournalistApplicationByUserId(supabase, user.id).catch(() => null),
    getDictionary(locale),
  ])

  return (
    <ProfileClient
      dict={dict.pressProfile}
      user={{ id: user.id, email: user.email ?? '' }}
      downloadCount={history.length}
      application={application}
    />
  )
}
