export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { getPressPhotos } from '@/lib/api/pressPhotos'
import { PressKitList } from './_components/PressKitList'

export default async function PressKitPage() {
  const supabase = await createServerSupabaseClient()
  const flags = await getFeatureFlagsForRole(supabase, 'journalist').catch(() => ({} as Record<string, boolean>))
  if (flags['journalist.press_kit'] === false) {
    return <p className="text-muted-foreground">Press kit is currently disabled.</p>
  }

  const photos = await getPressPhotos(supabase).catch(() => [])
  return <PressKitList photos={photos} />
}
