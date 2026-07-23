export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { getFormSchema } from '@/lib/api/submissionFormSchema'
import { VideoSubmissionForm } from './_components/VideoSubmissionForm'

export default async function NewVideoPage({
  searchParams,
}: {
  searchParams: Promise<{ artistId?: string }>
}) {
  const { artistId } = await searchParams
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const artist = user ? await resolvePortalArtist(supabase, user.id, artistId).catch(() => null) : null
  const formSchema = await getFormSchema(supabase, 'video').catch(() => [])

  return <VideoSubmissionForm formSchema={formSchema} artist={artist} />
}
