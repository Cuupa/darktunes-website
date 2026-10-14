export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getPromoReleases } from '@/lib/api/releases'
import { getPromoTracks, isPromoEmbargoActive } from '@/lib/api/promoTracks'
import { isPressAudioPreviewEnabled, isPromoPoolEnabled } from '@/lib/pressAccess'
import { getTranslations } from 'next-intl/server'
import { PromoDownloads } from './_components/PromoDownloads'

export default async function PressPromoPoolPage() {
  const supabase = await createServerSupabaseClient()
  const promoPoolEnabled = await isPromoPoolEnabled(supabase)
  if (!promoPoolEnabled) {
    const t = await getTranslations('pressDashboard')
    return <p className="text-muted-foreground">{t('promoPoolDisabled')}</p>
  }

  const [releases, promoTracks, audioPreviewEnabled] = await Promise.all([
    getPromoReleases(supabase).catch(() => []),
    getPromoTracks(supabase)
      .then((rows) => rows.filter((track) => !isPromoEmbargoActive(track.embargoUntil)))
      .catch(() => []),
    isPressAudioPreviewEnabled(supabase),
  ])

  return (
    <PromoDownloads
      releases={releases}
      promoTracks={promoTracks}
      audioPreviewEnabled={audioPreviewEnabled}
    />
  )
}