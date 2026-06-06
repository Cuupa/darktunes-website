/**
 * app/portal/invoices/page.tsx — Artist Invoices (Server Component)
 */

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { listArtistInvoices } from '@/lib/api/artistInvoices'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { Skeleton } from '@/components/ui/skeleton'
import { InvoicesClient } from './_components/InvoicesClient'

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

async function InvoicesContent() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const flags = await getFeatureFlagsForRole(supabase, 'artist').catch(() => ({} as Record<string, boolean>))
  if (flags['artist.invoices'] === false) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{dict.portal.invoices_heading}</h1>
        <p className="text-muted-foreground">
          The Invoices feature is currently unavailable.
        </p>
      </div>
    )
  }

  const artist = await getArtistByUserId(supabase, user.id).catch(() => null)
  const { invoices } = artist
    ? await listArtistInvoices(supabase, artist.id).catch(() => ({ invoices: [], total: 0 }))
    : { invoices: [] }

  return (
    <InvoicesClient
      dict={dict.portal}
      invoices={invoices}
      artistId={artist?.id ?? ''}
    />
  )
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<InvoicesSkeleton />}>
      <InvoicesContent />
    </Suspense>
  )
}
