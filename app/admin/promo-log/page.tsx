/**
 * app/admin/promo-log/page.tsx — Promo Log Admin (Server Component)
 *
 * Lists all artists and their promo-log entries.
 * Passes data to the client component for CRUD interactions.
 */

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { getArtists } from '@/lib/api/artists'
import { getPromoLogEntries } from '@/lib/api/promoLog'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PromoLogAdmin } from './_components/PromoLogAdmin'

async function PromoLogContent({ searchParams }: { searchParams: Promise<{ artistId?: string }> }) {
  const { artistId } = await searchParams
  const supabase = await createServerSupabaseClient()

  const artists = await getArtists(supabase).catch(() => [])
  const activeArtist = artistId
    ? artists.find((artist) => artist.id === artistId) ?? artists[0] ?? null
    : artists[0] ?? null

  const entries = activeArtist
    ? await getPromoLogEntries(supabase, activeArtist.id).catch(() => [])
    : []

  return (
    <PromoLogAdmin
      artists={artists}
      activeArtistId={activeArtist?.id ?? null}
      initialEntries={entries}
    />
  )
}

export default function PromoLogPage({ searchParams }: { searchParams: Promise<{ artistId?: string }> }) {
  return (
    <div className="max-w-4xl p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <PromoLogContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
