/**
 * app/portal/releases/page.tsx — Release Management (Server Component)
 *
 * Fetches releases + checklists for the current artist.
 * Only seeds checklists for the first 10 releases to avoid N+1 overhead.
 */

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { getReleasesByArtistId } from '@/lib/api/releases'
import { getOrCreateReleaseChecklist } from '@/lib/api/releaseChecklists'
import { Skeleton } from '@/components/ui/skeleton'
import { ReleaseChecklistPanel } from './_components/ReleaseChecklist'
import type { ReleaseChecklist } from '@/lib/api/releaseChecklists'
import { getPortalDictionary } from '@/i18n/getDictionary'

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

async function ReleasesContent({ searchParams }: { searchParams: Promise<{ artistId?: string }> }) {
  const dict = await getPortalDictionary()
  const { artistId } = await searchParams
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch(() => null)
  const releases = artist
    ? await getReleasesByArtistId(supabase, artist.id).catch(() => [])
    : []

  const today = new Date().toISOString().split('T')[0]
  // Split into upcoming (checklist needed) and already-released (read-only)
  const upcomingReleases = releases.filter((r) => !r.releaseDate || r.releaseDate > today)
  const releasedReleases = releases.filter((r) => r.releaseDate && r.releaseDate <= today)

  // Only seed checklists for upcoming releases to avoid N+1 overhead
  const checklistsByReleaseId: Record<string, ReleaseChecklist[]> = {}
  if (artist) {
    const top10 = upcomingReleases.slice(0, 10)
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
      releases={upcomingReleases}
      releasedReleases={releasedReleases}
      checklistsByReleaseId={checklistsByReleaseId}
    />
  )
}

export default function ReleasesPage({ searchParams }: { searchParams: Promise<{ artistId?: string }> }) {
  return (
    <Suspense fallback={<ReleasesSkeleton />}>
      <ReleasesContent searchParams={searchParams} />
    </Suspense>
  )
}
