export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getInterviewRequestsByJournalistId } from '@/lib/api/interviewRequests'
import { InterviewRequestsClient } from './_components/InterviewRequestsClient'

export default async function PressInterviewsPage() {
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
      initialRequests={requests}
      artists={artistsResult.data ?? []}
    />
  )
}