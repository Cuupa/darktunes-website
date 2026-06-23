import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { getEpkShareLinkByToken } from '@/lib/api/epkShareLinks'
import { getArtistById } from '@/lib/api/artists'
import { EpkSharePageClient } from './_components/EpkSharePageClient'

export const metadata: Metadata = {
  title: 'Shared Press Kit — darkTunes Music Group',
  robots: { index: false, follow: false },
}

export default async function EpkSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const db = await createServiceRoleSupabaseClient()
  const link = await getEpkShareLinkByToken(db, token).catch(() => null)
  if (!link) notFound()

  const artist = await getArtistById(db, link.artistId).catch(() => null)
  if (!artist?.isVisible) notFound()

  return (
    <EpkSharePageClient
      token={token}
      artistName={artist.name}
      hasPassword={link.hasPassword}
      linkLabel={link.label}
    />
  )
}