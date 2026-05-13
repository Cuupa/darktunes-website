/**
 * app/artists/page.tsx — Dedicated artists grid page (RSC)
 *
 * Shows all public artists as a photo grid.
 * Hovering a card reveals the band logo (if set) or the artist name.
 * Clicking opens the artist detail page.
 */

import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { getPublicArtists } from '@/lib/api/artists'
import { ArtistsGridContent } from './_components/ArtistsGridContent'
import type { Database } from '@/types/database'
import type { Artist } from '@/types'

function createPublicSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
  )
}

const getCachedArtists = unstable_cache(
  async (): Promise<Artist[]> => getPublicArtists(createPublicSupabaseClient()),
  ['artists-page'],
  { revalidate: 60, tags: ['artists'] },
)

export default async function ArtistsPage() {
  const [artists, locale] = await Promise.all([
    getCachedArtists().catch(() => [] as Artist[]),
    getLocale(),
  ])

  const dict = await getDictionary(locale)

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <div className="container mx-auto px-4 lg:px-16 pt-36 pb-24">
        <div className="mb-12">
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-accent font-mono uppercase tracking-widest mb-6 inline-block"
          >
            ← {dict.navigation.home}
          </Link>
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mt-2">{dict.navigation.artists}</h1>
        </div>
        <ArtistsGridContent artists={artists} />
      </div>
    </main>
  )
}
