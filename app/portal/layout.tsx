/**
 * app/portal/layout.tsx — Artist Portal layout (Server Component)
 *
 * Wraps all /portal/* routes (except /portal/login which renders standalone).
 * Auth is enforced by middleware.ts before this layout renders.
 * Fetches the current user and their linked artist for the sidebar.
 *
 * Access rule:
 *   - Role 'artist' or 'admin': full portal access (must also have linked artist)
 *   - Role 'user' (unassigned): blocked — shows "Pending Approval" page
 *   - Other roles (editor, journalist): no portal access
 */

export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { PortalSidebar } from './_components/PortalSidebar'
import { PortalAccessGate } from './_components/PortalAccessGate'

export const metadata: Metadata = {
  title: 'Artist Portal — darkTunes Music Group',
  robots: { index: false, follow: false },
}

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch the user's role from their profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'user'

  // Only 'artist' and 'admin' roles may access the portal
  const hasPortalAccess = role === 'artist' || role === 'admin'

  if (!hasPortalAccess) {
    return <PortalAccessGate role={role} />
  }

  const artist = await getArtistByUserId(supabase, user.id).catch(() => null)
  const [featureFlags, unreadMessagesResult] = await Promise.all([
    getFeatureFlagsForRole(supabase, 'artist').catch(() => ({} as Record<string, boolean>)),
    artist
      ? supabase
          .from('label_messages')
          .select('id', { count: 'exact', head: true })
          .eq('artist_id', artist.id)
          .eq('read', false)
      : Promise.resolve({ count: 0, error: null }),
  ])
  const unreadMessages = unreadMessagesResult.count ?? 0

  return (
    <div className="min-h-screen bg-background flex">
      <PortalSidebar
        dict={dict.portal}
        artistName={artist?.name ?? null}
        userId={user?.id ?? null}
        artistSlug={artist?.slug ?? null}
        featureFlags={featureFlags}
        unreadMessages={unreadMessages}
      />
      <main className="flex-1 p-6 md:p-8 max-w-5xl mx-auto w-full">{children}</main>
    </div>
  )
}
