export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { getPressPhotos } from '@/lib/api/pressPhotos'
import { PressKitList } from './_components/PressKitList'

export default async function PressKitPage() {
  const locale = await getLocale()
  const supabase = await createServerSupabaseClient()
  const [photos, dict] = await Promise.all([
    getPressPhotos(supabase).catch(() => []),
    getDictionary(locale),
  ])
  return <PressKitList photos={photos} dict={dict.pressKit} />
}
