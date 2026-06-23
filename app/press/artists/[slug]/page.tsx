export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistBySlug } from '@/lib/api/artists'
import { getPressKitForArtist } from '@/lib/api/pressKit'
import { getConcertsByArtistId } from '@/lib/api/concerts'
import { getPublicArtistEpkByArtistId } from '@/lib/api/publicArtistEpk'
import { listEpkFonts, buildEpkFontPublicUrl } from '@/lib/api/epkFonts'
import { hydrateDocumentFonts } from '@/lib/epk/editor/hydrateDocumentFonts'
import type { Database } from '@/types/database'
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

  const { serverEnv } = await import('@/lib/env.server')
  const publicClient = createClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )

  const [publicEpk, photos, concerts, fonts] = await Promise.all([
    getPublicArtistEpkByArtistId(publicClient, artist.id).catch(() => null),
    getPressKitForArtist(supabase, artist.id).catch(() => []),
    getConcertsByArtistId(supabase, artist.id).catch(() => []),
    listEpkFonts(publicClient, artist.id).catch(() => []),
  ])

  const hydratedDocument =
    publicEpk?.document && fonts.length > 0
      ? hydrateDocumentFonts(
          publicEpk.document,
          fonts.map((font) => ({
            id: font.id,
            publicUrl: buildEpkFontPublicUrl(font.r2Key, serverEnv.CLOUDFLARE_R2_PUBLIC_URL),
          })),
        )
      : publicEpk?.document ?? null

  return (
    <ArtistEpkClient
      artist={artist}
      profile={publicEpk?.profile ?? null}
      canvasDocument={hydratedDocument}
      photos={photos}
      concerts={concerts}
    />
  )
}