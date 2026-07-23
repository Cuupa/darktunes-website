export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { getFormSchema } from '@/lib/api/submissionFormSchema'
import { getReleaseTypeRules } from '@/lib/api/submissionReleaseTypeRules'
import { ReleaseSubmissionForm } from './_components/ReleaseSubmissionForm'

export default async function NewReleasePage({
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
  const [formSchema, typeRules] = await Promise.all([
    getFormSchema(supabase, 'release').catch(() => []),
    getReleaseTypeRules(supabase).catch(() => []),
  ])

  return (
    <Suspense fallback={<p className="text-muted-foreground p-4">Loading…</p>}>
      <ReleaseSubmissionForm artist={artist} formSchema={formSchema} typeRules={typeRules} />
    </Suspense>
  )
}
