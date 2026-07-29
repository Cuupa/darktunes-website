export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getBillingProfile, isBillingProfileComplete } from '@/lib/api/artistBillingProfiles'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { BillingProfileAssistant } from './_components/BillingProfileAssistant'
import { getMetadataBrand, portalPageTitle } from '@/lib/seo/metadata'

export async function generateMetadata(): Promise<Metadata> {
  const { labelShortName } = await getMetadataBrand()
  return {
    title: portalPageTitle('Billing Profile', labelShortName),
    description: 'Manage artist billing master data for SOS-linked invoices.',
  }
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ artistId?: string; mode?: string; focus?: string }>
}) {

  const { artistId, mode, focus } = await searchParams

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch(() => null)
  const billingProfile = artist ? await getBillingProfile(supabase, artist.id).catch(() => null) : null
  const complete = isBillingProfileComplete(billingProfile)

  return (
    <BillingProfileAssistant
      artistId={artist?.id ?? ''}
      billingProfile={billingProfile}
      isComplete={complete}
      forceAssistant={mode === 'assistant' || focus === 'payout' || !complete}
    />
  )
}
