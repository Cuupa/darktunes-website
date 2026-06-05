export const dynamic = 'force-dynamic'

import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { getFormSchema } from '@/lib/api/submissionFormSchema'
import { ReleaseSubmissionForm } from './_components/ReleaseSubmissionForm'

export default async function NewReleasePage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const artist = user ? await getArtistByUserId(supabase, user.id).catch(() => null) : null
  const formSchema = await getFormSchema(supabase, 'release').catch(() => [])

  return <ReleaseSubmissionForm dict={dict.portal} artist={artist} formSchema={formSchema} />
}
