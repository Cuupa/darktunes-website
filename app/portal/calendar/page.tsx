/**
 * app/portal/calendar/page.tsx — Unified portal calendar (Server Component)
 *
 * Auth stays request-scoped; release + concert rows come from shared Data Cache
 * so cold opens stay fast. Calendar is always available for signed-in artists.
 */

import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import {
  getCachedCalendarConcerts,
  getCachedCalendarReleases,
} from '@/lib/cache/publicQueries'
import { Skeleton } from '@/components/ui/skeleton'
import { ReleaseCalendarClient } from './_components/ReleaseCalendarClient'

function CalendarSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-40 rounded-full" />
        <Skeleton className="h-9 w-36 rounded-full" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    </div>
  )
}

async function CalendarContent({
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

  const [releases, concerts, artist] = await Promise.all([
    getCachedCalendarReleases(),
    getCachedCalendarConcerts(),
    resolvePortalArtist(supabase, user.id, artistId).catch(() => null),
  ])

  return (
    <ReleaseCalendarClient
      releases={releases}
      concerts={concerts}
      currentArtistId={artist?.id ?? null}
    />
  )
}

export default function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ artistId?: string }>
}) {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <CalendarContent searchParams={searchParams} />
    </Suspense>
  )
}
