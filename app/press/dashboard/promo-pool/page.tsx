export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { getPromoReleases } from '@/lib/api/releases'
import { getPromoTracks } from '@/lib/api/promoTracks'
import { PromoDownloads } from './_components/PromoDownloads'

export default async function PressPromoPoolPage() {
  const locale = await getLocale()
  const supabase = await createServerSupabaseClient()
  const [releases, promoTracks, dict] = await Promise.all([
    getPromoReleases(supabase).catch(() => []),
    getPromoTracks(supabase).catch(() => []),
    getDictionary(locale),
  ])

  return <PromoDownloads releases={releases} promoTracks={promoTracks} dict={dict.promoPool} />
}
