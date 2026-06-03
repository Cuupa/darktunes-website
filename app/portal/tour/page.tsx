/**
 * app/portal/tour/page.tsx — Tour Dates (Server Component)
 *
 * Fetches upcoming concerts for the current artist and renders TourList.
 */

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { getConcertsByArtistId } from '@/lib/api/concerts'
import { Skeleton } from '@/components/ui/skeleton'
import { TourList } from './_components/TourList'

function TourSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  )
}

async function TourContent() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const artist = await getArtistByUserId(supabase, user.id).catch(() => null)
  const concerts = artist
    ? await getConcertsByArtistId(supabase, artist.id).catch(() => [])
    : []
  return <TourList dict={dict.portal} concerts={concerts} artistId={artist?.id ?? null} />
}

export default function TourPage() {
  return (
    <Suspense fallback={<TourSkeleton />}>
      <TourContent />
    </Suspense>
  )
}
