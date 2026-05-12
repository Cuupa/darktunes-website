/**
 * app/portal/profile/page.tsx — Profile editor page (Server Component)
 *
 * Fetches the current artist and their EPK profile, then passes the data
 * to the ProfileForm client component. Server Component ensures zero bundle
 * overhead for data fetching.
 */

export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId, getArtistProfileByArtistId } from '@/lib/api/artistProfiles'
import { Skeleton } from '@/components/ui/skeleton'
import { ProfileForm } from './_components/ProfileForm'

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

async function ProfileContent() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const artist = await getArtistByUserId(supabase, user.id).catch(() => null)
  const profile = artist
    ? await getArtistProfileByArtistId(supabase, artist.id).catch(() => null)
    : null

  return (
    <ProfileForm
      dict={dict.portal}
      artistId={artist?.id ?? null}
      artistSlug={artist?.slug ?? null}
      initialProfile={profile}
    />
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent />
    </Suspense>
  )
}
