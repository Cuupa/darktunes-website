/**
 * app/portal/layout.tsx — Artist Portal layout (Server Component)
 *
 * Wraps all /portal/* routes (except /portal/login which renders standalone).
 * Auth is enforced by middleware.ts before this layout renders.
 * Fetches the current user and their linked artists for the sidebar.
 *
 * Access rule:
 *   - Has at least one row in artist_members: full portal access
 *   - Role 'admin': full portal access (overrides membership check)
 *   - Role 'user' (unassigned): blocked — shows "Pending Approval" page
 *   - Other roles (editor, journalist) without membership: no portal access
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistsByUserId, getArtistProfileByArtistId, isProfileComplete } from '@/lib/api/artistProfiles'
import { getFeatureFlagsForRole } from '@/lib/api/featureFlags'
import { PortalSidebar } from './_components/PortalSidebar'
import { PortalAccessGate } from './_components/PortalAccessGate'
import { PortalNotificationProvider } from './_components/PortalNotificationProvider'
import { Warning } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getPortalDictionary } from '@/i18n/getDictionary'

export const metadata: Metadata = {
  title: 'Artist Portal — darkTunes Music Group',
  robots: { index: false, follow: false },
}

function PortalLayoutSkeleton() {
  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row overflow-x-clip">
      {/* Desktop sidebar skeleton */}
      <div className="hidden md:flex flex-col w-64 border-r border-border bg-card p-6 space-y-4">
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
  const dict = await getPortalDictionary()

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
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'user'

  // Fetch all artist memberships for this user
  let artists: Awaited<ReturnType<typeof getArtistsByUserId>> = []
  let artistError: string | null = null

  try {
    artists = await getArtistsByUserId(supabase, user.id)
  } catch (error) {
    console.error('[PortalLayout] Failed to fetch artist data:', error)
    artistError = error instanceof Error ? error.message : 'Unknown database error'
  }

  // Admins always get in; everyone else needs at least one artist membership
  const hasPortalAccess = role === 'admin' || artists.length > 0

  if (!hasPortalAccess) {
    return <PortalAccessGate role={role} />
  }

  // If artist fetch failed and we have an error, show a recovery page
  if (artistError) {
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

  // Determine the active artist from the ?artistId query param (read from request URL via headers),
  // falling back to the first artist.
  const { headers } = await import('next/headers')
  const headersList = await headers()
  const currentPath = headersList.get('x-pathname') ?? ''
  const requestUrl = headersList.get('x-url') ?? ''
  let requestedArtistId: string | null = null
  try {
    if (requestUrl) {
      requestedArtistId = new URL(requestUrl).searchParams.get('artistId')
    }
  } catch {
    // ignore malformed URL
  }
  const artist = (requestedArtistId
    ? artists.find((a) => a.id === requestedArtistId)
    : null) ?? artists[0] ?? null

  const [featureFlags, unreadMessagesResult, artistProfile] = await Promise.all([
    getFeatureFlagsForRole(supabase, 'artist').catch(() => ({} as Record<string, boolean>)),
    artist
      ? supabase
          .from('label_messages')
          .select('id', { count: 'exact', head: true })
          .eq('artist_id', artist.id)
          .eq('read', false)
          .is('deleted_at', null)
      : Promise.resolve({ count: 0, error: null }),
    artist
      ? getArtistProfileByArtistId(supabase, artist.id).catch(() => null)
      : Promise.resolve(null),
  ])
  const unreadMessages = unreadMessagesResult.count ?? 0

  // Redirect to onboarding if the artist profile is incomplete and the wizard
  // has not been completed/skipped yet.  We skip the redirect when the user is
  // already on the /portal/onboarding route to avoid a redirect loop.
  const isOnOnboarding = currentPath.startsWith('/portal/onboarding')

  if (
    artist &&
    !isOnOnboarding &&
    artistProfile !== null &&
    !artistProfile.onboardingCompleted &&
    !isProfileComplete(artistProfile, artist)
  ) {
    redirect('/portal/onboarding')
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row overflow-x-clip">
      <PortalNotificationProvider
        artistId={artist?.id ?? null}
        initialUnreadCount={unreadMessages}
      >
        <PortalSidebar
          dict={dict.portal}
          artists={artists}
          userId={user?.id ?? null}
          featureFlags={featureFlags}
        />
        <main className="flex-1 p-6 md:p-8 max-w-5xl mx-auto w-full border-t md:border-t-0 border-primary/10">{children}</main>
      </PortalNotificationProvider>
    </div>
  )
}
