export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { listArtistNewsByArtistId } from '@/lib/api/artistNews'
import { ArtistNewsClient } from './_components/ArtistNewsClient'

export default async function PortalNewsPage({
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

  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch(() => null)
  const posts = artist
    ? await listArtistNewsByArtistId(supabase, artist.id).catch(() => [])
    : []

  return (
    <ArtistNewsClient
      artistId={artist?.id ?? null}
      artistName={artist?.name ?? null}
      initialPosts={posts}
    />
  )
}
