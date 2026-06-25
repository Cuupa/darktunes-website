export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getJournalistPressKit } from '@/lib/api/pressKit'
import { PressKitList } from './_components/PressKitList'

export default async function PressKitPage() {
  const supabase = await createServerSupabaseClient()
  const assets = await getJournalistPressKit(supabase).catch(() => [])

  return <PressKitList assets={assets} />
}