/**
 * app/portal/statements/page.tsx — Royalty Statements (Server Component)
 *
 * Fetches the artist's statements server-side and passes them to the
 * StatementsTable client leaf component. Follows IoC principle.
 *
 * If the 'sosStatements' feature toggle is disabled, an unavailable message
 * is shown instead of the statements table.
 */

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { getSalesStatementsByArtistId } from '@/lib/api/salesStatements'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { Skeleton } from '@/components/ui/skeleton'
import { StatementsTable } from './_components/StatementsTable'

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

async function StatementsContent() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)

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

  const artist = await getArtistByUserId(supabase, user.id).catch(() => null)
  const statements = artist
    ? await getSalesStatementsByArtistId(supabase, artist.id).catch(() => [])
    : []

  return <StatementsTable dict={dict.portal} statements={statements} />
}

export default function StatementsPage() {
  return (
    <Suspense fallback={<StatementsSkeleton />}>
      <StatementsContent />
    </Suspense>
  )
}
