/**
 * app/portal/calendar/page.tsx — Release Calendar (Server Component)
 *
 * Fetches all visible label releases and the current artist's ID for the
 * "My Releases" filter. Passes data to the ReleaseCalendarClient leaf component.
 */

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { getAllVisibleReleasesForCalendar } from '@/lib/api/releases'
import { getPortalDictionary } from '@/i18n/getDictionary'
import { Skeleton } from '@/components/ui/skeleton'
import { ReleaseCalendarClient } from './_components/ReleaseCalendarClient'

function CalendarSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-56" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-32 rounded-full" />
        <Skeleton className="h-9 w-32 rounded-full" />
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
  const dict = await getPortalDictionary()
  const { artistId } = await searchParams

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [releases, artist] = await Promise.all([
    getAllVisibleReleasesForCalendar(supabase).catch(() => []),
    resolvePortalArtist(supabase, user.id, artistId).catch(() => null),
  ])

  return (
    <ReleaseCalendarClient
      dict={dict.portal}
      releases={releases}
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
