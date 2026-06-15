export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { listArtistInvoices } from '@/lib/api/artistInvoices'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { getSalesStatementsByArtistId } from '@/lib/api/salesStatements'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { Skeleton } from '@/components/ui/skeleton'
import { StatementsTable } from './_components/StatementsTable'
import { getPortalDictionary } from '@/i18n/getDictionary'

export const metadata: Metadata = {
  title: 'Statements | darkTunes Portal',
  description: 'Review royalty statements and create linked invoices.',
}

function StatementsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}

async function StatementsContent({ searchParams }: { searchParams: Promise<{ artistId?: string }> }) {
  const dict = await getPortalDictionary()
  const { artistId } = await searchParams

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const flags = await getFeatureFlagsForRole(supabase, 'artist').catch(() => ({} as Record<string, boolean>))
  if (flags['artist.statements'] === false) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{dict.portal.statements_heading}</h1>
        <p className="text-muted-foreground">
          The Statement of Sales feature is currently unavailable. Please contact the label for more information.
        </p>
      </div>
    )
  }

  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch(() => null)
  const statements = artist ? await getSalesStatementsByArtistId(supabase, artist.id).catch(() => []) : []
  const { invoices } = artist
    ? await listArtistInvoices(supabase, artist.id, 1, 200).catch(() => ({ invoices: [], total: 0 }))
    : { invoices: [] }

  return (
    <StatementsTable
      artistId={artist?.id}
      dict={dict.portal}
      invoicedStatementIds={invoices.flatMap((invoice) => (invoice.statementId ? [invoice.statementId] : []))}
      statements={statements}
    />
  )
}

export default function StatementsPage({ searchParams }: { searchParams: Promise<{ artistId?: string }> }) {
  return (
    <Suspense fallback={<StatementsSkeleton />}>
      <StatementsContent searchParams={searchParams} />
    </Suspense>
  )
}
