/**
 * app/promo-pool/page.tsx — Promo Pool main page (Server Component)
 *
 * Fetches available promo tracks and passes them to the client component.
 * Access is already verified by the layout — only journalists/admins reach here.
 */

export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getPromoTracks } from '@/lib/api/promoTracks'
import { PromoPoolClient } from './_components/PromoPoolClient'

export default async function PromoPoolPage() {
  const supabase = await createServerSupabaseClient()
  const tracks = await getPromoTracks(supabase).catch(() => [])

  return <PromoPoolClient tracks={tracks} />
}