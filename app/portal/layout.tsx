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
export const revalidate = 0
export const fetchCache = 'force-no-store'

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import { getDictionary, getLocale } from '@/i18n/getDictionary'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId } from '@/lib/api/artistProfiles'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { PortalSidebar } from './_components/PortalSidebar'
import { PortalAccessGate } from './_components/PortalAccessGate'
import { Warning } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: 'Artist Portal — darkTunes Music Group',
  robots: { index: false, follow: false },
}

function PortalLayoutSkeleton() {
  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden">
      {/* Desktop sidebar skeleton */}
      <div className="max-md:hidden flex flex-col w-64 border-r border-border bg-card p-6 space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      {/* Mobile header skeleton */}
      <header className="md:hidden sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card px-4 w-full">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-10 w-10 rounded" />
      </header>
      {/* Main content skeleton */}
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  )
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PortalLayoutSkeleton />}>
      <PortalLayoutContent>{children}</PortalLayoutContent>
    </Suspense>
  )
}

async function PortalLayoutContent({ children }: { children: ReactNode }) {
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // No user — let children render (middleware already handles redirecting
  // non-login portal routes to /portal/login, so here we only reach this
  // branch for /portal/login itself where the login form must be visible).
  if (!user) return <>{children}</>

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

  let artist = null
  let artistError = null

  try {
    artist = await getArtistByUserId(supabase, user.id)
  } catch (error) {
    console.error('[PortalLayout] Failed to fetch artist data:', error)
    artistError = error instanceof Error ? error.message : 'Unknown database error'
  }

  // If artist fetch failed and we have an error, show a recovery page
  if (artistError && !artist) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <Warning size={32} className="text-destructive" role="img" aria-label="Error" />
          </div>
          <h1 className="text-2xl font-bold">Unable to Load Artist Data</h1>
          <p className="text-muted-foreground">
            We encountered an error while loading your artist profile. This may be a temporary issue.
          </p>
          <p className="text-sm font-mono bg-muted p-3 rounded text-left">{artistError}</p>
          <div className="flex gap-3 justify-center">
            <Link href="/portal">
              <Button variant="default">Retry</Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline">Contact Support</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

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
    <div className="min-h-screen bg-background flex flex-col md:flex-row overflow-x-hidden">
      <PortalSidebar
        dict={dict.portal}
        artistName={artist?.name ?? null}
        userId={user?.id ?? null}
        artistSlug={artist?.slug ?? null}
        featureFlags={featureFlags}
        unreadMessages={unreadMessages}
      />
      <main className="flex-1 overflow-y-auto p-6 md:p-8 max-w-5xl mx-auto w-full border-t md:border-t-0 border-primary/10">{children}</main>
    </div>
  )
}
