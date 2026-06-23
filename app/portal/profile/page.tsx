/**
 * app/portal/profile/page.tsx — Profile editor page (Server Component)
 *
 * Fetches the current artist and their EPK profile, then passes the data
 * to the ProfileForm client component. Server Component ensures zero bundle
 * overhead for data fetching.
 */

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistProfileByArtistId, resolvePortalArtist } from '@/lib/api/artistProfiles'
import { getCachedSiteSettings } from '@/lib/cache/publicQueries'
import { Skeleton } from '@/components/ui/skeleton'
import { ProfileForm } from './_components/ProfileForm'
import { getPortalDictionary } from '@/i18n/getDictionary'

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}

async function ProfileContent({ searchParams }: { searchParams: Promise<{ artistId?: string }> }) {
  const dict = await getPortalDictionary()
  const { artistId } = await searchParams

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const [artist, siteSettings] = await Promise.all([
    resolvePortalArtist(supabase, user.id, artistId).catch(() => null),
    getCachedSiteSettings().catch(() => null),
  ])
  const profile = artist
    ? await getArtistProfileByArtistId(supabase, artist.id).catch(() => null)
    : null

  return (
    <ProfileForm
      dict={dict.portal}
      errors={dict.errors}
      artistId={artist?.id ?? null}
      artistName={artist?.name ?? null}
      artistSlug={artist?.slug ?? null}
      initialProfile={profile}
      artist={artist}
      labelName={siteSettings?.labelName ?? null}
      labelLogoUrl={siteSettings?.logoUrl ?? null}
    />
  )
}

export default function ProfilePage({ searchParams }: { searchParams: Promise<{ artistId?: string }> }) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent searchParams={searchParams} />
    </Suspense>
  )
}
