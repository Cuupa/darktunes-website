export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getBillingProfile, isBillingProfileComplete } from '@/lib/api/artistBillingProfiles'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { BillingProfileForm } from './_components/BillingProfileForm'

export const metadata: Metadata = {
  title: 'Billing Profile | darkTunes Portal',
  description: 'Manage artist billing master data for SOS-linked invoices.',
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ artistId?: string }>
}) {

  const { artistId } = await searchParams

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch(() => null)
  const billingProfile = artist ? await getBillingProfile(supabase, artist.id).catch(() => null) : null

  return (
    <BillingProfileForm
      artistId={artist?.id ?? ''}
      billingProfile={billingProfile}
      isComplete={isBillingProfileComplete(billingProfile)}
    />
  )
}
