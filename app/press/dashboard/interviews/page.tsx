export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getInterviewRequestsByJournalistId } from '@/lib/api/interviewRequests'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { InterviewRequestsClient } from './_components/InterviewRequestsClient'

export default async function PressInterviewsPage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [requests, artistsResult] = await Promise.all([
    getInterviewRequestsByJournalistId(supabase, user.id).catch(() => []),
    supabase.from('artists').select('id,name').eq('is_visible', true).order('name'),
  ])

  return (
    <InterviewRequestsClient
      title={dict.pressDashboard.interviews}
      initialRequests={requests}
      artists={artistsResult.data ?? []}
      labels={{
        artist: dict.pressDashboard.artist,
        subject: dict.pressDashboard.subject,
        message: dict.pressDashboard.message,
        preferredDate: dict.pressDashboard.preferredDate,
        submit: dict.pressDashboard.submit,
        submitting: dict.pressDashboard.submitting,
        empty: dict.pressDashboard.noInterviews,
        error: dict.pressDashboard.error,
        success: dict.pressDashboard.success,
        pending: dict.pressDashboard.pending,
        accepted: dict.pressDashboard.accepted,
        rejected: dict.pressDashboard.rejected,
      }}
    />
  )
}
