'use client'
import { useState } from 'react'
import { useAuthContext } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SignOut, User, MusicNotes, Newspaper, VideoCamera, Image as ImageIcon, Gear, Heartbeat, Broadcast, Users, ToggleRight } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { ArtistsManager } from './ArtistsManager'
import { ReleasesManager } from './ReleasesManager'
import { NewsManager } from './NewsManager'
import { VideosManager } from './VideosManager'
import { AssetsManager } from './AssetsManager'
import { SiteSettingsManager } from './SiteSettingsManager'
import { SystemHealthWidget } from './SystemHealthWidget'
import { JournalistManager } from './JournalistManager'
import { UsersManager } from './UsersManager'
import { FeatureTogglesManager } from './FeatureTogglesManager'
import { useSiteSettings } from '@/hooks/useSiteSettings'

export function AdminDashboard() {
  const { user, profile, signOut, session } = useAuthContext()
  const [activeTab, setActiveTab] = useState('artists')
  const { settings: siteSettings, isLoading: siteSettingsLoading, saveSettings } = useSiteSettings()

  const isAdmin = profile?.role === 'admin'
  const isEditor = profile?.role === 'editor'

  // Tabs visible only to admin (not editor)
  const adminOnlyTabs = ['assets', 'settings', 'health', 'media', 'users', 'features']

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

  // Compute which tabs are available for this role
  const canSeeTab = (tab: string) => {
    if (isAdmin) return true
    if (isEditor) return !adminOnlyTabs.includes(tab)
    return false
  }

  // Count visible tabs for grid layout
  const visibleTabCount = ['artists', 'releases', 'news', 'videos', 'assets', 'settings', 'health', 'media', 'users', 'features']
    .filter(canSeeTab).length

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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full lg:w-auto lg:inline-grid" style={{ gridTemplateColumns: `repeat(${visibleTabCount}, minmax(0, 1fr))` }}>
            <TabsTrigger value="artists" className="gap-2">
              <User size={16} weight="bold" aria-hidden="true" />
              Artists
            </TabsTrigger>
            <TabsTrigger value="releases" className="gap-2">
              <MusicNotes size={16} weight="bold" aria-hidden="true" />
              Releases
            </TabsTrigger>
            <TabsTrigger value="news" className="gap-2">
              <Newspaper size={16} weight="bold" aria-hidden="true" />
              News
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-2">
              <VideoCamera size={16} weight="bold" aria-hidden="true" />
              Videos
            </TabsTrigger>
            {canSeeTab('assets') && (
              <TabsTrigger value="assets" className="gap-2">
                <ImageIcon size={16} weight="bold" aria-hidden="true" />
                Assets
              </TabsTrigger>
            )}
            {canSeeTab('settings') && (
              <TabsTrigger value="settings" className="gap-2">
                <Gear size={16} weight="bold" aria-hidden="true" />
                Settings
              </TabsTrigger>
            )}
            {canSeeTab('health') && (
              <TabsTrigger value="health" className="gap-2">
                <Heartbeat size={16} weight="bold" aria-hidden="true" />
                Health
              </TabsTrigger>
            )}
            {canSeeTab('media') && (
              <TabsTrigger value="media" className="gap-2">
                <Broadcast size={16} weight="bold" aria-hidden="true" />
                Media
              </TabsTrigger>
            )}
            {canSeeTab('features') && (
              <TabsTrigger value="features" className="gap-2">
                <ToggleRight size={16} weight="bold" aria-hidden="true" />
                Features
              </TabsTrigger>
            )}
            {canSeeTab('users') && (
              <TabsTrigger value="users" className="gap-2">
                <Users size={16} weight="bold" aria-hidden="true" />
                Users
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="artists" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Artists Management</CardTitle>
                <CardDescription>
                  Manage label artists, their information, and social links
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ArtistsManager />
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
                <ReleasesManager />
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
                <NewsManager />
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
                <VideosManager />
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
                  <AssetsManager />
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
                  <SiteSettingsManager value={siteSettings} onChange={saveSettings} isLoading={siteSettingsLoading} />
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
                  <SystemHealthWidget bearerToken={session?.access_token ?? ''} />
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
                  <JournalistManager />
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
                  <FeatureTogglesManager
                    value={siteSettings.featureToggles ?? { promoPool: true, sosStatements: true, editorTools: true }}
                    onChange={(toggles) => void handleSaveFeatureToggles({ ...siteSettings, featureToggles: toggles })}
                    isLoading={siteSettingsLoading}
                  />
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
                  <UsersManager />
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  )
}
