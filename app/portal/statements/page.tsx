/**
 * app/portal/statements/page.tsx — Royalty Statements (Server Component)
 *
 * Fetches the artist's statements server-side and passes them to the
 * StatementsTable client leaf component. Follows IoC principle.
 *
 * If the 'artist.statements' portal feature flag is disabled, an unavailable message
 * is shown instead of the statements table.
 */

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { getSalesStatementsByArtistId } from '@/lib/api/salesStatements'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { Skeleton } from '@/components/ui/skeleton'
import { StatementsTable } from './_components/StatementsTable'
import { getPortalDictionary } from '@/i18n/getDictionary'

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
  const statements = artist
    ? await getSalesStatementsByArtistId(supabase, artist.id).catch(() => [])
    : []

  return <StatementsTable dict={dict.portal} statements={statements} />
}

export default function StatementsPage({ searchParams }: { searchParams: Promise<{ artistId?: string }> }) {
  return (
    <Suspense fallback={<StatementsSkeleton />}>
      <StatementsContent searchParams={searchParams} />
    </Suspense>
  )
}
