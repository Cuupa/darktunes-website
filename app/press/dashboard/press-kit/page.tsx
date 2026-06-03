export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getPressPhotos } from '@/lib/api/pressPhotos'
import { PressKitList } from './_components/PressKitList'

export default async function PressKitPage() {
  const supabase = await createServerSupabaseClient()
  const photos = await getPressPhotos(supabase).catch(() => [])
  return <PressKitList photos={photos} />
}
