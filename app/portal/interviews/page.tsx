export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { getInterviewRequestsByArtistId } from '@/lib/api/interviewRequests'
import { PortalInterviewsClient } from './_components/PortalInterviewsClient'
import { getTranslations } from 'next-intl/server'

export default async function PortalInterviewsPage({ searchParams }: { searchParams: Promise<{ artistId?: string }> }) {
  const t = await getTranslations('portal')

  const { artistId } = await searchParams
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch(() => null)
  const requests = artist ? await getInterviewRequestsByArtistId(supabase, artist.id).catch(() => []) : []

  return <PortalInterviewsClient initialRequests={requests} />
}
