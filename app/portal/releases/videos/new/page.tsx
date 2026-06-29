export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getFormSchema } from '@/lib/api/submissionFormSchema'
import { VideoSubmissionForm } from './_components/VideoSubmissionForm'

export default async function NewVideoPage() {
  const supabase = await createServerSupabaseClient()
  const formSchema = await getFormSchema(supabase, 'video').catch(() => [])

  return <VideoSubmissionForm formSchema={formSchema} />
}