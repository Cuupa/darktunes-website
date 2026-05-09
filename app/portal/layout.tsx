/**
 * app/portal/layout.tsx — Artist Portal layout (Server Component)
 *
 * Wraps all /portal/* routes (except /portal/login which renders standalone).
 * Auth is enforced by middleware.ts before this layout renders.
 * Fetches the current user and their linked artist for the sidebar.
 */

export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { PortalSidebar } from './_components/PortalSidebar'

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

  const artist = user ? await getArtistByUserId(supabase, user.id).catch(() => null) : null

  return (
    <div className="min-h-screen bg-background flex">
      <PortalSidebar dict={dict.portal} artistName={artist?.name ?? null} userId={user?.id ?? null} />
      <main className="flex-1 p-6 md:p-8 max-w-5xl mx-auto w-full">{children}</main>
    </div>
  )
}
