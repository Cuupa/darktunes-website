export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getBillingProfile, isBillingProfileComplete } from '@/lib/api/artistBillingProfiles'
import { listArtistInvoices } from '@/lib/api/artistInvoices'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { getSalesStatementById } from '@/lib/api/salesStatements'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Skeleton } from '@/components/ui/skeleton'
import { getPortalDictionary } from '@/i18n/getDictionary'
import { InvoicesClient } from './_components/InvoicesClient'

export const metadata: Metadata = {
  title: 'Invoices | darkTunes Portal',
  description: 'Create and manage invoices, including SOS-linked invoices.',
}

function InvoicesSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}

async function InvoicesContent({
  searchParams,
}: {
  searchParams: Promise<{ artistId?: string; statement?: string }>
}) {
  const dict = await getPortalDictionary()
  const { artistId, statement } = await searchParams

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const flags = await getFeatureFlagsForRole(supabase, 'artist').catch(() => ({} as Record<string, boolean>))
  if (flags['artist.invoices'] === false) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{dict.portal.invoices_heading}</h1>
        <p className="text-muted-foreground">The Invoices feature is currently unavailable.</p>
      </div>
    )
  }

  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch(() => null)
  const { invoices } = artist
    ? await listArtistInvoices(supabase, artist.id, 1, 200).catch(() => ({ invoices: [], total: 0 }))
    : { invoices: [] }
  const billingProfile = artist ? await getBillingProfile(supabase, artist.id).catch(() => null) : null
  const selectedStatement = artist && statement
    ? await getSalesStatementById(supabase, statement, artist.id).catch(() => null)
    : null

  return (
    <InvoicesClient
      artistId={artist?.id ?? ''}
      billingProfile={billingProfile}
      billingProfileComplete={isBillingProfileComplete(billingProfile)}
      dict={dict.portal}
      invoices={invoices}
      statement={selectedStatement}
    />
  )
}

export default function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ artistId?: string; statement?: string }>
}) {
  return (
    <Suspense fallback={<InvoicesSkeleton />}>
      <InvoicesContent searchParams={searchParams} />
    </Suspense>
  )
}
