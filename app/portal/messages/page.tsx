export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistsByUserId } from '@/lib/api/artistProfiles'
import { getPortalFolders } from '@/lib/api/portalMessages'
import { getArtists } from '@/lib/api/artists'
import { Skeleton } from '@/components/ui/skeleton'
import { PortalMailbox } from '@/components/portal/PortalMailbox'
import type { Artist } from '@/types'

function MessagesSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full" />
      ))}
    </div>
  )
}

async function MessagesContent({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const params = searchParams ? await searchParams : {}
  const artistIdParam = params?.artistId

  const userArtists = await getArtistsByUserId(supabase, user.id).catch(() => [])
  if (userArtists.length === 0) return null

  // Resolve active artist from ?artistId or default to first
  const activeArtist = (artistIdParam
    ? userArtists.find((a) => a.id === artistIdParam)
    : null) ?? userArtists[0]

  const [allArtists, folders] = await Promise.all([
    getArtists(supabase).catch(() => [] as Artist[]),
    getPortalFolders(supabase, activeArtist.id).catch(() => []),
  ])

  return (
    <PortalMailbox
      artistId={activeArtist.id}
      artists={allArtists}
      initialFolders={folders}
    />
  )
}

export default function PortalMessagesPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  return (
    <Suspense fallback={<MessagesSkeleton />}>
      <MessagesContent searchParams={searchParams} />
    </Suspense>
  )
}

