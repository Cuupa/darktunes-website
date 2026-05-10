/**
 * app/portal/releases/page.tsx — Release Management (Server Component)
 *
 * Fetches releases + checklists for the current artist.
 * Only seeds checklists for the first 10 releases to avoid N+1 overhead.
 */

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { getReleasesByArtistId } from '@/lib/api/releases'
import { getOrCreateReleaseChecklist } from '@/lib/api/releaseChecklists'
import { Skeleton } from '@/components/ui/skeleton'
import { ReleaseChecklistPanel } from './_components/ReleaseChecklist'
import type { ReleaseChecklist } from '@/lib/api/releaseChecklists'

function ReleasesSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
  )
}

async function ReleasesContent() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const artist = await getArtistByUserId(supabase, user.id).catch(() => null)
  const releases = artist
    ? await getReleasesByArtistId(supabase, artist.id).catch(() => [])
    : []

  // Only seed checklists for the first 10 releases to avoid N+1 overhead
  const checklistsByReleaseId: Record<string, ReleaseChecklist[]> = {}
  if (artist) {
    const top10 = releases.slice(0, 10)
    const results = await Promise.allSettled(
      top10.map((r) => getOrCreateReleaseChecklist(supabase, artist.id, r.id)),
    )
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        checklistsByReleaseId[top10[idx].id] = result.value
      }
    })
  }

  return (
    <ReleaseChecklistPanel
      dict={dict.portal}
      releases={releases}
      checklistsByReleaseId={checklistsByReleaseId}
    />
  )
}

export default function ReleasesPage() {
  return (
    <Suspense fallback={<ReleasesSkeleton />}>
      <ReleasesContent />
    </Suspense>
  )
}
