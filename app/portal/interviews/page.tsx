export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { getInterviewRequestsByArtistId } from '@/lib/api/interviewRequests'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { PortalInterviewsClient } from './_components/PortalInterviewsClient'

export default async function PortalInterviewsPage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const artist = await getArtistByUserId(supabase, user.id).catch(() => null)
  const requests = artist ? await getInterviewRequestsByArtistId(supabase, artist.id).catch(() => []) : []

  return <PortalInterviewsClient dict={dict.portal} initialRequests={requests} />
}
