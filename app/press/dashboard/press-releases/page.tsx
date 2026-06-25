export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getPressOnlyNewsPosts } from '@/lib/api/pressReleases'
import { PressReleasesClient } from './_components/PressReleasesClient'

export default async function PressReleasesPage() {
  const supabase = await createServerSupabaseClient()
  const posts = await getPressOnlyNewsPosts(supabase).catch(() => [])

  return <PressReleasesClient posts={posts} />
}