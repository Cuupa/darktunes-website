export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { getFormSchema } from '@/lib/api/submissionFormSchema'
import { ReleaseSubmissionForm } from './_components/ReleaseSubmissionForm'
import { getPortalDictionary } from '@/i18n/getDictionary'

export default async function NewReleasePage({ searchParams }: { searchParams: Promise<{ artistId?: string }> }) {
  const dict = await getPortalDictionary()
  const { artistId } = await searchParams
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const artist = user ? await resolvePortalArtist(supabase, user.id, artistId).catch(() => null) : null
  const formSchema = await getFormSchema(supabase, 'release').catch(() => [])

  return <ReleaseSubmissionForm dict={dict.portal} artist={artist} formSchema={formSchema} />
}
