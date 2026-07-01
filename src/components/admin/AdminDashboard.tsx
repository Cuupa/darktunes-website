'use client'
import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthContext } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  SignOut,
  User,
  MusicNotes,
  Newspaper,
  VideoCamera,
  Image as ImageIcon,
  ToggleRight,
  FileText,
  Calendar,
  Wrench,
  Tag,
  MegaphoneSimple,
  Globe,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useSiteSettings } from '@/hooks/useSiteSettings'
import { useRolePermissions } from '@/hooks/useRolePermissions'
import { editorCanAccessTab, type EditorDashboardTab } from '@/lib/editor/editorTabPermissions'
import { DashboardNotificationBell } from './DashboardNotificationBell'
import { EditorPromoLogPanel } from './EditorPromoLogPanel'

// Heavy manager panels are lazy-loaded so each tab's JS bundle is fetched only
// when the user first opens that tab, keeping the initial admin page lightweight.
const ArtistsManager = lazy(() => import('./ArtistsManager').then((m) => ({ default: m.ArtistsManager })))
const ReleasesManager = lazy(() => import('./ReleasesManager').then((m) => ({ default: m.ReleasesManager })))
const NewsManager = lazy(() => import('./NewsManager').then((m) => ({ default: m.NewsManager })))
const VideosManager = lazy(() => import('./VideosManager').then((m) => ({ default: m.VideosManager })))
const AssetsManager = lazy(() => import('./AssetsManager').then((m) => ({ default: m.AssetsManager })))
const AccreditationsManager = lazy(() => import('./AccreditationsManager').then((m) => ({ default: m.AccreditationsManager })))
const StatementsManager = lazy(() => import('./StatementsManager').then((m) => ({ default: m.StatementsManager })))
const PressManager = lazy(() => import('./PressManager').then((m) => ({ default: m.PressManager })))
const ReleaseSubmissionsManager = lazy(() => import('./ReleaseSubmissionsManager').then((m) => ({ default: m.ReleaseSubmissionsManager })))
const VideoSubmissionsManager = lazy(() => import('./VideoSubmissionsManager').then((m) => ({ default: m.VideoSubmissionsManager })))
const FanPageReviewsManager = lazy(() => import('./FanPageReviewsManager').then((m) => ({ default: m.FanPageReviewsManager })))
const SubmissionFormManager = lazy(() => import('./SubmissionFormManager').then((m) => ({ default: m.SubmissionFormManager })))
const AdminConcertsManager = lazy(() => import('./AdminConcertsManager').then((m) => ({ default: m.AdminConcertsManager })))
const MaintenanceManager = lazy(() => import('./MaintenanceManager').then((m) => ({ default: m.MaintenanceManager })))
const GenresManager = lazy(() => import('./GenresManager').then((m) => ({ default: m.GenresManager })))

function TabFallback() {
  return (
    <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading panel">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab definitions — single source of truth for labels, icons, and metadata
// ---------------------------------------------------------------------------

type TabValue =
  | 'artists' | 'releases' | 'news' | 'videos' | 'assets'
  | 'accreditations' | 'press' | 'statements'
  | 'release-submissions' | 'video-submissions' | 'fan-page-reviews' | 'submission-form'
  | 'events' | 'genres' | 'maintenance' | 'promo-log'

interface TabDef {
  value: TabValue
  label: string
  /** True if only admins can see this tab */
  adminOnly: boolean
  icon: React.ElementType
}

const TAB_DEFS: TabDef[] = [
  { value: 'artists',        label: 'Artists',            adminOnly: false, icon: User },
  { value: 'releases',       label: 'Releases',           adminOnly: false, icon: MusicNotes },
  { value: 'news',           label: 'News',               adminOnly: false, icon: Newspaper },
  { value: 'videos',         label: 'Videos',             adminOnly: false, icon: VideoCamera },
  { value: 'events',         label: 'Events',             adminOnly: false, icon: Calendar },
  { value: 'genres',         label: 'Genres',             adminOnly: false, icon: Tag },
  { value: 'assets',         label: 'Assets',             adminOnly: true,  icon: ImageIcon },
  { value: 'accreditations', label: 'Accreditations',     adminOnly: true,  icon: Newspaper },
  { value: 'press',          label: 'Press Portal',       adminOnly: true,  icon: Newspaper },
  { value: 'statements',     label: 'Statements',         adminOnly: true,  icon: FileText },
  { value: 'release-submissions', label: 'Release Submissions', adminOnly: false, icon: MusicNotes },
  { value: 'video-submissions',   label: 'Video Submissions',   adminOnly: false, icon: VideoCamera },
  { value: 'fan-page-reviews',    label: 'Fan Page Reviews',    adminOnly: false, icon: Globe },
  { value: 'promo-log',           label: 'Promo Log',           adminOnly: false, icon: MegaphoneSimple },
  { value: 'submission-form',     label: 'Submission Form',     adminOnly: true,  icon: FileText },
  { value: 'maintenance',         label: 'Maintenance',         adminOnly: true,  icon: Wrench },
]

const ALL_TAB_VALUES = TAB_DEFS.map((t) => t.value)

// Static card titles and descriptions for each tab panel
const TAB_PANEL_META: Record<TabValue, { title: string; description: string }> = {
  artists:         { title: 'Artists Management',                description: 'Manage label artists, their information, and social links' },
  releases:        { title: 'Releases Management',               description: 'Manage music releases, albums, EPs, and singles' },
  news:            { title: 'News Management',                   description: 'Create and manage news posts and announcements' },
  videos:          { title: 'Videos Management',                 description: 'Manage music videos and YouTube content' },
  events:          { title: 'Live Shows Management',             description: 'Manage concert and tour dates for any artist. Select an artist to edit their schedule on behalf of the label.' },
  genres:          { title: 'Genre Catalogue',                    description: 'Manage the central genre list used for artist tagging. Genres added here are available as a pick-list in all artist forms.' },
  assets:          { title: 'Assets Management',                 description: 'Upload and manage images, covers, and media files' },
  accreditations:  { title: 'Accreditations',                    description: 'Review journalist accreditation requests and approve or reject them.' },
  press:           { title: 'Press Portal',                      description: 'Manage journalist applications, press kit assets, promo tracks, accreditations, and portal analytics.' },
  statements:      { title: 'Statements',                        description: 'Read-only overview of all uploaded Statement-of-Sales PDFs across all artists.' },
  'release-submissions': { title: 'Release Submissions',          description: 'Review and manage artist release submissions.' },
  'video-submissions':   { title: 'Video Submissions',            description: 'Review and manage artist music video submissions.' },
  'fan-page-reviews':    { title: 'Fan Page Reviews',             description: 'Review artist fan pages submitted from the portal and approve or reject publication.' },
  'promo-log':           { title: 'Promo Log',                    description: 'Document label marketing work per artist and keep the portal timeline up to date.' },
  'submission-form':     { title: 'Submission Form',              description: 'Configure which fields appear in the release and video submission forms.' },
  'maintenance':         { title: 'Maintenance',                  description: 'System maintenance: clear logs, purge data, reset states, revalidate caches.' },
}

function isValidTab(value: string | null): value is TabValue {
  return ALL_TAB_VALUES.includes(value as TabValue)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AdminDashboardProps {
  contentOnly?: boolean
  /**
   * When true (default) the component renders its own full-page wrapper,
   * sticky header, and sign-out button — used on the /editor standalone page
   * and via AdminApp.
   * When false the component renders only the tabs section, relying on the
   * surrounding AdminClientLayout to supply the page shell (sidebar, header).
   */
  standalone?: boolean
}

export function AdminDashboard({ contentOnly = false, standalone = true }: AdminDashboardProps) {
  const { user, profile, signOut, loading: authLoading } = useAuthContext()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { settings: siteSettings, isLoading: siteSettingsLoading } = useSiteSettings()
  const { permissions, loading: permissionsLoading, isAdmin } = useRolePermissions()

  const isEditor = profile?.role === 'editor'

  const canSeeTab = useCallback((tab: TabValue) => {
    const def = TAB_DEFS.find((t) => t.value === tab)
    if (!def) return false
    if (isAdmin) return true
    if (def.adminOnly) return false
    if (isEditor) {
      return editorCanAccessTab(tab as EditorDashboardTab, permissions)
    }
    if (contentOnly) return !def.adminOnly
    return false
  }, [contentOnly, isAdmin, isEditor, permissions])

  const getDefaultTab = useCallback((): TabValue => {
    const firstVisible = TAB_DEFS.find((def) => canSeeTab(def.value))
    return firstVisible?.value ?? 'releases'
  }, [canSeeTab])

  const getInitialTab = useCallback((): TabValue => {
    const tabParam = searchParams.get('tab')
    if (isValidTab(tabParam) && canSeeTab(tabParam)) return tabParam
    return getDefaultTab()
  }, [searchParams, canSeeTab, getDefaultTab])

  const [activeTab, setActiveTab] = useState<TabValue>('releases')

  useEffect(() => {
    if (authLoading || permissionsLoading) return
    setActiveTab(getInitialTab())
  }, [authLoading, permissionsLoading, getInitialTab])

  // Sync tab from URL on mount and when search params change
  useEffect(() => {
    if (authLoading || permissionsLoading) return
    const tabParam = searchParams.get('tab')
    if (isValidTab(tabParam) && canSeeTab(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam)
      return
    }
    if (!canSeeTab(activeTab)) {
      setActiveTab(getDefaultTab())
    }
    // intentionally exclude activeTab to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, authLoading, permissionsLoading, canSeeTab, getDefaultTab])

  const handleTabChange = useCallback((value: string) => {
    const tab = value as TabValue
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    const nextUrl = contentOnly ? `/editor?${params.toString()}` : `?${params.toString()}`
    router.replace(nextUrl, { scroll: false })
  }, [router, searchParams, contentOnly])

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (error) {
      toast.error('Failed to sign out')
    } else {
      toast.success('Signed out successfully')
      if (standalone && (contentOnly || isEditor)) {
        router.push('/login')
      }
    }
  }

  if (authLoading || permissionsLoading || siteSettingsLoading) {
    return (
      <div className={standalone ? 'min-h-screen bg-background flex items-center justify-center p-4' : 'flex flex-1 items-center justify-center py-16'} aria-busy="true" aria-label="Loading dashboard">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  // If editor tools feature is disabled, editors cannot access the admin
  if (isEditor && !siteSettings.featureToggles?.editorTools && !siteSettingsLoading) {
    return (
      <div className={standalone ? 'min-h-screen bg-background flex items-center justify-center' : 'flex flex-1 items-center justify-center py-16'}>
        <div className="text-center space-y-4 max-w-md px-4">
          <ToggleRight size={48} className="text-muted-foreground mx-auto" role="img" aria-label="Feature disabled" />
          <h1 className="text-2xl font-bold">Editor Tools Disabled</h1>
          <p className="text-muted-foreground">
            The Editor Tools feature has been disabled by an administrator. Please contact your admin if you believe this is an error.
          </p>
          {standalone && (
            <Button variant="outline" onClick={handleSignOut}>
              <SignOut size={16} className="mr-2" aria-hidden="true" />
              Sign Out
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Filtered list of tabs visible to this user
  const visibleTabs = TAB_DEFS.filter((def) => canSeeTab(def.value))

  if (visibleTabs.length === 0) {
    return (
      <div className={standalone ? 'min-h-screen bg-background flex items-center justify-center' : 'flex flex-1 items-center justify-center py-16'}>
        <div className="text-center space-y-4 max-w-md px-4">
          <ToggleRight size={48} className="text-muted-foreground mx-auto" role="img" aria-label="No permissions" />
          <h1 className="text-2xl font-bold">No Editor Permissions</h1>
          <p className="text-muted-foreground">
            Your account does not have any content permissions assigned. Please contact your administrator.
          </p>
          {standalone && (
            <Button variant="outline" onClick={handleSignOut}>
              <SignOut size={16} className="mr-2" aria-hidden="true" />
              Sign Out
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={standalone ? 'min-h-screen bg-background' : undefined}>
      {standalone && (
        <header className="border-b border-border bg-card sticky top-0 z-40">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{contentOnly ? 'darkTunes Editor' : 'darkTunes Admin'}</h1>
              <p className="text-sm text-muted-foreground">
                {contentOnly ? 'Editor Dashboard' : 'Content Management System'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {contentOnly && user?.id && <DashboardNotificationBell userId={user.id} />}
              <div className="text-right">
                <p className="text-sm font-medium">{user?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
              </div>
              <Button
                onClick={handleSignOut}
                variant="outline"
                size="sm"
              >
                <SignOut size={16} weight="bold" className="mr-2" aria-hidden="true" />
                Sign Out
              </Button>
            </div>
          </div>
        </header>
      )}

      <main className={standalone ? 'container mx-auto px-4 py-8' : 'px-4 py-6'}>
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          {/* Tab bar */}
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            {visibleTabs.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} className="gap-2">
                <Icon size={16} weight="bold" aria-hidden="true" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab content panels — each manager is lazy-loaded on first tab visit.
              Panel components for tabs with special props are defined here as a
              Record so the renderer below stays declarative and DRY. */}
          {(() => {
            const tabPanelContent: Partial<Record<TabValue, React.ReactNode>> = {
              artists:         <ArtistsManager />,
              releases:        <ReleasesManager />,
              news:            <NewsManager />,
              videos:          <VideosManager />,
              events:          <AdminConcertsManager />,
              genres:          <GenresManager />,
              assets:          <AssetsManager variant="embedded" />,
              accreditations:  <AccreditationsManager />,
              press:           <PressManager />,
              statements:      <StatementsManager />,
              'release-submissions': <ReleaseSubmissionsManager />,
              'video-submissions':   <VideoSubmissionsManager />,
              'fan-page-reviews':    <FanPageReviewsManager />,
              'promo-log':           <EditorPromoLogPanel />,
              'submission-form':     <SubmissionFormManager variant="embedded" />,
              'maintenance':         <MaintenanceManager />,
            }

            return TAB_DEFS.map(({ value, adminOnly }) => {
              if (adminOnly && !canSeeTab(value)) return null
              const meta = TAB_PANEL_META[value]
              const content = tabPanelContent[value]
              if (value === 'assets') {
                return (
                  <TabsContent key={value} value={value} className="min-h-0">
                    <Suspense fallback={<TabFallback />}>
                      {content}
                    </Suspense>
                  </TabsContent>
                )
              }
              return (
                <TabsContent key={value} value={value} className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>{meta.title}</CardTitle>
                      <CardDescription>{meta.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Suspense fallback={<TabFallback />}>
                        {content}
                      </Suspense>
                    </CardContent>
                  </Card>
                </TabsContent>
              )
            })
          })()}
        </Tabs>
      </main>
    </div>
  )
}
