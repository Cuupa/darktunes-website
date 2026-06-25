export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getPromoReleases } from '@/lib/api/releases'
import { getPromoTracks } from '@/lib/api/promoTracks'
import { PromoDownloads } from './_components/PromoDownloads'

export default async function PressPromoPoolPage() {
  const supabase = await createServerSupabaseClient()
  const [releases, promoTracks] = await Promise.all([
    getPromoReleases(supabase).catch(() => []),
    getPromoTracks(supabase).catch(() => []),
  ])

  return <PromoDownloads releases={releases} promoTracks={promoTracks} />
}