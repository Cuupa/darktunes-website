export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { getJournalistPressKit } from '@/lib/api/pressKit'
import { PressKitList } from './_components/PressKitList'

export default async function PressKitPage() {
  const locale = await getLocale()
  const supabase = await createServerSupabaseClient()
  const [assets, dict] = await Promise.all([
    getJournalistPressKit(supabase).catch(() => []),
    getDictionary(locale),
  ])
  return <PressKitList assets={assets} dict={dict.pressKit} />
}
