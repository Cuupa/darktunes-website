/**
 * app/portal/epk-builder/page.tsx — EPK Canvas Builder (Phase 1)
 */

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  getArtistProfileByArtistId,
  resolvePortalArtist,
} from '@/lib/api/artistProfiles'
import { ensureMigratedEpkDocument } from '@/lib/api/epkDocument'
import { getArtistAssets } from '@/lib/api/artistAssets'
import { getAssetsByArtist } from '@/lib/api/assets'
import { buildEpkPickerAssets } from '@/lib/epk/pickerAssets'
import { buildEpkFontPublicUrl, listEpkFonts } from '@/lib/api/epkFonts'
import { getReleasesByArtistId } from '@/lib/api/releases'
import { getVideosByArtistId } from '@/lib/api/videos'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { getCachedSiteSettings } from '@/lib/cache/publicQueries'
import { getTranslations } from 'next-intl/server'
import { Skeleton } from '@/components/ui/skeleton'
import { EpkBuilderClient } from './_components/EpkBuilderClient'
import { emptyArtistProfile } from '@/lib/epk/migrate/emptyArtistProfile'

export const metadata = {
  title: 'EPK Builder | darkTunes Artist Portal',
  description: 'Build and export your Electronic Press Kit',
}

function EpkBuilderSkeleton() {


  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-[480px] w-full max-w-2xl mx-auto" />
    </div>
  )
}

async function EpkBuilderContent({ searchParams }: { searchParams: Promise<{ artistId?: string }> }) {

  const t = await getTranslations('portal')

  const { artistId } = await searchParams

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/portal/login')

  const flags = await getFeatureFlagsForRole(supabase, 'artist').catch(
    (): Record<string, boolean> => ({}),
  )
  if (flags['artist.epk_builder'] === false) notFound()

  const artist = await resolvePortalArtist(supabase, user.id, artistId).catch(() => null)
  if (!artist) {
    return (
      <p className="text-muted-foreground">{t('notLinked')}</p>
    )
  }

  const [profile, siteSettings, assets, labelAssets, fontRecords, catalogReleases, catalogVideos] =
    await Promise.all([
      getArtistProfileByArtistId(supabase, artist.id).catch(() => null),
      getCachedSiteSettings().catch(() => null),
      getArtistAssets(supabase, artist.id).catch(() => []),
      getAssetsByArtist(supabase, artist.id).catch(() => []),
      listEpkFonts(supabase, artist.id).catch(() => []),
      getReleasesByArtistId(supabase, artist.id).catch(() => []),
      getVideosByArtistId(supabase, artist.id).catch(() => []),
    ])

  const pickerAssets = buildEpkPickerAssets({
    artist,
    artistProfile: profile,
    artistAssets: assets,
    labelAssets,
  })

  const { serverEnv } = await import('@/lib/env.server')
  const initialFonts = fontRecords.map((font) => ({
    id: font.id,
    name: font.name,
    family: font.name,
    r2Key: font.r2Key,
    mimeType: font.mimeType,
    publicUrl: buildEpkFontPublicUrl(font.r2Key, serverEnv.CLOUDFLARE_R2_PUBLIC_URL),
    createdAt: font.createdAt,
  }))

  const state = await ensureMigratedEpkDocument(
    supabase,
    artist.id,
    profile ?? emptyArtistProfile(artist.id),
    artist,
    siteSettings?.labelName ?? undefined,
  )

  return (
    <EpkBuilderClient
      artistId={artist.id}
      artistName={artist.name}
      artist={artist}
      artistProfile={profile}
      initialDocument={state.document}
      documentVersion={state.documentVersion}
      initialAssets={assets}
      pickerAssets={pickerAssets}
      initialFonts={initialFonts}
      catalogReleases={catalogReleases}
      catalogVideos={catalogVideos}
    />
  )
}

export default function EpkBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ artistId?: string }>
}) {
  return (
    <Suspense fallback={<EpkBuilderSkeleton />}>
      <EpkBuilderContent searchParams={searchParams} />
    </Suspense>
  )
}