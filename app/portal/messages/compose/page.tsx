export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistsByUserId } from '@/lib/api/artistProfiles'
import { getArtists } from '@/lib/api/artists'
import { Skeleton } from '@/components/ui/skeleton'
import { PortalComposeClient } from './_components/PortalComposeClient'
import type { Artist } from '@/types'

function ComposeSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

async function ComposeContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const params = searchParams ? await searchParams : {}
  const artistIdParam = params?.artistId

  const userArtists = await getArtistsByUserId(supabase, user.id).catch(() => [])
  if (userArtists.length === 0) return null

  const activeArtist =
    (artistIdParam ? userArtists.find((a) => a.id === artistIdParam) : null) ?? userArtists[0]

  const allArtists = await getArtists(supabase).catch(() => [] as Artist[])

  return (
    <PortalComposeClient
      artistId={activeArtist.id}
      artists={allArtists}
    />
  )
}

export default function PortalMessagesComposePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>
}) {
  return (
    <Suspense fallback={<ComposeSkeleton />}>
      <ComposeContent searchParams={searchParams} />
    </Suspense>
  )
}
