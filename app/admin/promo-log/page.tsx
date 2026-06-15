/**
 * app/admin/promo-log/page.tsx — Promo Log Admin (Server Component)
 *
 * Loads all artists server-side, resolves the active artist from the
 * `?artistId=` search param, and renders PromoLogManager (with clipboard
 * paste support) together with a client-side artist-selector dropdown.
 */

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { getArtists } from '@/lib/api/artists'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PromoLogManager } from '@/components/admin/PromoLogManager'
import { AdminPageShell } from '../_components/AdminPageShell'
import { PromoLogArtistSelector } from './_components/PromoLogArtistSelector'

async function PromoLogContent({
  searchParams,
}: {
  searchParams: Promise<{ artistId?: string }>
}) {
  const { artistId } = await searchParams
  const supabase = await createServerSupabaseClient()
  const artists = await getArtists(supabase).catch(() => [])

  const activeArtist = artistId
    ? (artists.find((a) => a.id === artistId) ?? artists[0] ?? null)
    : (artists[0] ?? null)

  return (
    <div className="space-y-6">
      <PromoLogArtistSelector artists={artists} activeArtistId={activeArtist?.id ?? null} />

      {activeArtist ? (
        <PromoLogManager artistId={activeArtist.id} artistName={activeArtist.name} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No artists available yet. Add an artist before creating marketing activities.
        </p>
      )}
    </div>
  )
}

export default function PromoLogPage({
  searchParams,
}: {
  searchParams: Promise<{ artistId?: string }>
}) {
  return (
    <AdminPageShell
      title="Promo Log"
      description="Document label marketing work per artist and keep the portal timeline up to date."
    >
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <PromoLogContent searchParams={searchParams} />
      </Suspense>
    </AdminPageShell>
  )
}
