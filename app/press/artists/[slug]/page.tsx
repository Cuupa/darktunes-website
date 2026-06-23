export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistBySlug } from '@/lib/api/artists'
import { getArtistProfileByArtistId } from '@/lib/api/artistProfiles'
import { getPressKitForArtist } from '@/lib/api/pressKit'
import { getConcertsByArtistId } from '@/lib/api/concerts'
import { ArtistEpkClient } from './_components/ArtistEpkClient'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()
  const artist = await getArtistBySlug(supabase, slug).catch(() => null)
  return {
    title: artist ? `${artist.name} — Press Kit` : 'Artist Press Kit',
  }
}

export default async function ArtistEpkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()
  const artist = await getArtistBySlug(supabase, slug).catch(() => null)
  if (!artist) notFound()

  const [profile, photos, concerts] = await Promise.all([
    getArtistProfileByArtistId(supabase, artist.id).catch(() => null),
    getPressKitForArtist(supabase, artist.id).catch(() => []),
    getConcertsByArtistId(supabase, artist.id).catch(() => []),
  ])

  return <ArtistEpkClient artist={artist} profile={profile} photos={photos} concerts={concerts} />
}
