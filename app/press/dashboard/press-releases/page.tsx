export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { getPressOnlyNewsPosts } from '@/lib/api/pressReleases'
import { PressReleasesClient } from './_components/PressReleasesClient'

export default async function PressReleasesPage() {
  const locale = await getLocale()
  const supabase = await createServerSupabaseClient()
  const [posts, dict] = await Promise.all([
    getPressOnlyNewsPosts(supabase).catch(() => []),
    getDictionary(locale),
  ])

  return <PressReleasesClient posts={posts} dict={dict.pressReleases} />
}
