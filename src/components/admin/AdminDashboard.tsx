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
  Gear,
  Heartbeat,
  Broadcast,
  Users,
  ToggleRight,
  ClipboardText,
  ShieldCheck,
  ArrowUp,
  ArrowDown,
  ArrowsDownUp,
  CheckCircle,
  FileText,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useSiteSettings } from '@/hooks/useSiteSettings'

// Heavy manager panels are lazy-loaded so each tab's JS bundle is fetched only
// when the user first opens that tab, keeping the initial admin page lightweight.
const ArtistsManager = lazy(() => import('./ArtistsManager').then((m) => ({ default: m.ArtistsManager })))
const ReleasesManager = lazy(() => import('./ReleasesManager').then((m) => ({ default: m.ReleasesManager })))
const NewsManager = lazy(() => import('./NewsManager').then((m) => ({ default: m.NewsManager })))
const VideosManager = lazy(() => import('./VideosManager').then((m) => ({ default: m.VideosManager })))
const AssetsManager = lazy(() => import('./AssetsManager').then((m) => ({ default: m.AssetsManager })))
const SiteSettingsManager = lazy(() => import('./SiteSettingsManager').then((m) => ({ default: m.SiteSettingsManager })))
const SystemHealthWidget = lazy(() => import('./SystemHealthWidget').then((m) => ({ default: m.SystemHealthWidget })))
const MediaManager = lazy(() => import('./MediaManager').then((m) => ({ default: m.MediaManager })))
const UsersManager = lazy(() => import('./UsersManager').then((m) => ({ default: m.UsersManager })))
const FeatureTogglesManager = lazy(() => import('./FeatureTogglesManager').then((m) => ({ default: m.FeatureTogglesManager })))
const FeatureFlagsManager = lazy(() => import('./FeatureFlagsManager').then((m) => ({ default: m.FeatureFlagsManager })))
const MessagesManager = lazy(() => import('./MessagesManager').then((m) => ({ default: m.MessagesManager })))
const AccreditationsManager = lazy(() => import('./AccreditationsManager').then((m) => ({ default: m.AccreditationsManager })))
const LogsManager = lazy(() => import('./LogsManager').then((m) => ({ default: m.LogsManager })))
const RolesManager = lazy(() => import('./RolesManager').then((m) => ({ default: m.RolesManager })))
const StatementsManager = lazy(() => import('./StatementsManager').then((m) => ({ default: m.StatementsManager })))
const PressManager = lazy(() => import('./PressManager').then((m) => ({ default: m.PressManager })))

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
  | 'settings' | 'health' | 'media' | 'users' | 'features'
  | 'feature-flags' | 'messages' | 'accreditations' | 'press' | 'logs' | 'roles'
  | 'statements'

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
  { value: 'assets',         label: 'Assets',             adminOnly: true,  icon: ImageIcon },
  { value: 'settings',       label: 'Settings',           adminOnly: true,  icon: Gear },
  { value: 'health',         label: 'Health',             adminOnly: true,  icon: Heartbeat },
  { value: 'media',          label: 'Media',              adminOnly: true,  icon: Broadcast },
  { value: 'users',          label: 'Users',              adminOnly: true,  icon: Users },
  { value: 'features',       label: 'Site Toggles',       adminOnly: true,  icon: ToggleRight },
  { value: 'feature-flags',  label: 'Rollout Flags',      adminOnly: true,  icon: ToggleRight },
  { value: 'messages',       label: 'Messages',           adminOnly: true,  icon: Broadcast },
  { value: 'accreditations', label: 'Accreditations',     adminOnly: true,  icon: Newspaper },
  { value: 'press',          label: 'Press Portal',       adminOnly: true,  icon: Newspaper },
  { value: 'logs',           label: 'Logs',               adminOnly: true,  icon: ClipboardText },
  { value: 'roles',          label: 'Roles & Permissions',adminOnly: true,  icon: ShieldCheck },
  { value: 'statements',     label: 'Statements',         adminOnly: true,  icon: FileText },
]

const ALL_TAB_VALUES = TAB_DEFS.map((t) => t.value)
const LS_KEY = 'admin-tab-order'

function isValidTab(value: string | null): value is TabValue {
  return ALL_TAB_VALUES.includes(value as TabValue)
}

/** Load persisted order from localStorage, filling in any new tabs at the end */
function loadTabOrder(): TabValue[] {
  if (typeof window === 'undefined') return ALL_TAB_VALUES
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return ALL_TAB_VALUES
    const saved = JSON.parse(raw) as TabValue[]
    // Keep only known values, then append any new ones not yet saved
    const filtered = saved.filter((v) => isValidTab(v))
    const missing = ALL_TAB_VALUES.filter((v) => !filtered.includes(v))
    return [...filtered, ...missing]
  } catch {
    return ALL_TAB_VALUES
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdminDashboard() {
  const { user, profile, signOut, session } = useAuthContext()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { settings: siteSettings, isLoading: siteSettingsLoading, saveSettings } = useSiteSettings()

  const isAdmin = profile?.role === 'admin'
  const isEditor = profile?.role === 'editor'

  const getInitialTab = useCallback((): TabValue => {
    const tabParam = searchParams.get('tab')
    return isValidTab(tabParam) ? tabParam : 'artists'
  }, [searchParams])

  const [activeTab, setActiveTab] = useState<TabValue>(getInitialTab)
  const [tabOrder, setTabOrder] = useState<TabValue[]>(ALL_TAB_VALUES)
  const [reorderMode, setReorderMode] = useState(false)

  // Load persisted order after hydration
  useEffect(() => {
    setTabOrder(loadTabOrder())
  }, [])

  // Sync tab from URL on mount and when search params change
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (isValidTab(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
    // intentionally exclude activeTab to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleTabChange = useCallback((value: string) => {
    const tab = value as TabValue
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (error) {
      toast.error('Failed to sign out')
    } else {
      toast.success('Signed out successfully')
    }
  }

  const handleSaveFeatureToggles = async (updated: typeof siteSettings) => {
    await saveSettings(updated)
    toast.success('Feature toggles saved')
  }

  const canSeeTab = (tab: TabValue) => {
    const def = TAB_DEFS.find((t) => t.value === tab)
    if (!def) return false
    if (isAdmin) return true
    if (isEditor) return !def.adminOnly
    return false
  }

  // Move a tab up or down in the order list
  const moveTab = (value: TabValue, direction: 'up' | 'down') => {
    setTabOrder((prev) => {
      const idx = prev.indexOf(value)
      if (idx === -1) return prev
      const next = [...prev]
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= next.length) return prev
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      return next
    })
  }

  const handleDoneReorder = () => {
    setReorderMode(false)
    toast.success('Tab order saved')
  }

  // If editor tools feature is disabled, editors cannot access the admin
  if (isEditor && !siteSettings.featureToggles?.editorTools && !siteSettingsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-4">
          <ToggleRight size={48} className="text-muted-foreground mx-auto" role="img" aria-label="Feature disabled" />
          <h1 className="text-2xl font-bold">Editor Tools Disabled</h1>
          <p className="text-muted-foreground">
            The Editor Tools feature has been disabled by an administrator. Please contact your admin if you believe this is an error.
          </p>
          <Button variant="outline" onClick={handleSignOut}>
            <SignOut size={16} className="mr-2" aria-hidden="true" />
            Sign Out
          </Button>
        </div>
      </div>
    )
  }

  // Ordered + filtered list of tabs visible to this user
  const visibleTabs = tabOrder
    .map((v) => TAB_DEFS.find((t) => t.value === v))
    .filter((def): def is TabDef => !!def && canSeeTab(def.value))

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">darkTunes Admin</h1>
            <p className="text-sm text-muted-foreground">Content Management System</p>
          </div>
          <div className="flex items-center gap-4">
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

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          {/* Tab bar + reorder controls */}
          <div className="space-y-2">
            {!reorderMode ? (
              <div className="flex items-center gap-2 flex-wrap">
                <TabsList className="flex flex-wrap h-auto gap-1 p-1">
                  {visibleTabs.map(({ value, label, icon: Icon }) => (
                    <TabsTrigger key={value} value={value} className="gap-2">
                      <Icon size={16} weight="bold" aria-hidden="true" />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReorderMode(true)}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    title="Reorder tabs"
                  >
                    <ArrowsDownUp size={16} className="mr-1" aria-hidden="true" />
                    Reorder
                  </Button>
                )}
              </div>
            ) : (
              <div className="border border-border rounded-lg p-3 space-y-1 bg-card">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">Drag to reorder — use arrows to move tabs</p>
                  <Button size="sm" variant="default" onClick={handleDoneReorder}>
                    <CheckCircle size={16} className="mr-1" aria-hidden="true" />
                    Done
                  </Button>
                </div>
                {visibleTabs.map(({ value, label, icon: Icon }, idx) => (
                  <div
                    key={value}
                    className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50"
                  >
                    <Icon size={16} aria-hidden="true" className="text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm">{label}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={idx === 0}
                      onClick={() => moveTab(value, 'up')}
                      aria-label={`Move ${label} up`}
                    >
                      <ArrowUp size={14} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={idx === visibleTabs.length - 1}
                      onClick={() => moveTab(value, 'down')}
                      aria-label={`Move ${label} down`}
                    >
                      <ArrowDown size={14} aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tab content panels — each manager is lazy-loaded on first tab visit */}
          <TabsContent value="artists" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Artists Management</CardTitle>
                <CardDescription>
                  Manage label artists, their information, and social links
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<TabFallback />}>
                  <ArtistsManager />
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="releases" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Releases Management</CardTitle>
                <CardDescription>
                  Manage music releases, albums, EPs, and singles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<TabFallback />}>
                  <ReleasesManager />
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="news" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>News Management</CardTitle>
                <CardDescription>
                  Create and manage news posts and announcements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<TabFallback />}>
                  <NewsManager />
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="videos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Videos Management</CardTitle>
                <CardDescription>
                  Manage music videos and YouTube content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<TabFallback />}>
                  <VideosManager />
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>

          {canSeeTab('assets') && (
            <TabsContent value="assets" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Assets Management</CardTitle>
                  <CardDescription>
                    Upload and manage images, covers, and media files
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<TabFallback />}>
                    <AssetsManager />
                  </Suspense>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canSeeTab('settings') && (
            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Site Settings</CardTitle>
                  <CardDescription>
                    Manage global site content: social links, hero text, SEO metadata, and more
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<TabFallback />}>
                    <SiteSettingsManager value={siteSettings} onChange={saveSettings} isLoading={siteSettingsLoading} />
                  </Suspense>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canSeeTab('health') && (
            <TabsContent value="health" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>System Health &amp; API Status</CardTitle>
                  <CardDescription>
                    Monitor external API synchronisation status and trigger a manual sync
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<TabFallback />}>
                    <SystemHealthWidget bearerToken={session?.access_token ?? ''} />
                  </Suspense>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canSeeTab('media') && (
            <TabsContent value="media" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Press &amp; Media</CardTitle>
                  <CardDescription>
                    Manage journalist applications, press photos (EPK), and private promo tracks
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<TabFallback />}>
                    <MediaManager />
                  </Suspense>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canSeeTab('features') && (
            <TabsContent value="features" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Feature Toggles</CardTitle>
                  <CardDescription>
                    Enable or disable portal modules globally. Disabled features disappear from their dashboards and routes are secured.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<TabFallback />}>
                    <FeatureTogglesManager
                      value={siteSettings.featureToggles ?? { promoPool: true, editorTools: true }}
                      onChange={(toggles) => void handleSaveFeatureToggles({ ...siteSettings, featureToggles: toggles })}
                      isLoading={siteSettingsLoading}
                    />
                  </Suspense>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canSeeTab('users') && (
            <TabsContent value="users" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    Manage registered users: assign roles, ban/unban accounts, link artists, or delete users
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<TabFallback />}>
                    <UsersManager />
                  </Suspense>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canSeeTab('press') && (
            <TabsContent value="press" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Press Portal</CardTitle>
                  <CardDescription>
                    Manage journalist applications, press kit assets, promo tracks, accreditations, and portal analytics.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<TabFallback />}>
                    <PressManager />
                  </Suspense>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canSeeTab('feature-flags') && (
            <TabsContent value="feature-flags" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Portal &amp; Journalist Feature Flags</CardTitle>
                  <CardDescription>
                    Enable or disable sections for artist and journalist dashboards.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<TabFallback />}>
                    <FeatureFlagsManager />
                  </Suspense>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canSeeTab('messages') && (
            <TabsContent value="messages" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Artist Messages</CardTitle>
                  <CardDescription>
                    Send inbox messages to artists and track read status.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<TabFallback />}>
                    <MessagesManager />
                  </Suspense>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canSeeTab('accreditations') && (
            <TabsContent value="accreditations" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Accreditations</CardTitle>
                  <CardDescription>
                    Review journalist accreditation requests and approve or reject them.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<TabFallback />}>
                    <AccreditationsManager />
                  </Suspense>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canSeeTab('logs') && (
            <TabsContent value="logs" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Logs</CardTitle>
                  <CardDescription>
                    Audit log of all sync runs and error log for failed or partial syncs.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<TabFallback />}>
                    <LogsManager />
                  </Suspense>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canSeeTab('roles') && (
            <TabsContent value="roles" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Roles &amp; Permissions</CardTitle>
                  <CardDescription>
                    Configure what each user role is allowed to do. Admin always has full access.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<TabFallback />}>
                    <RolesManager />
                  </Suspense>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canSeeTab('statements') && (
            <TabsContent value="statements" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Statements</CardTitle>
                  <CardDescription>
                    Read-only overview of all uploaded Statement-of-Sales PDFs across all artists.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<TabFallback />}>
                    <StatementsManager />
                  </Suspense>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  )
}
