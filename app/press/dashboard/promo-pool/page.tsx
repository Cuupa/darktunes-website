export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getPromoReleases } from '@/lib/api/releases'
import { PromoDownloads } from './_components/PromoDownloads'

export default async function PressPromoPoolPage() {
  const supabase = await createServerSupabaseClient()
  const releases = await getPromoReleases(supabase).catch(() => [])

  return <PromoDownloads releases={releases} />
}
