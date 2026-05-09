'use client'
import { useState } from 'react'
import { useAuthContext } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SignOut, User, MusicNotes, Newspaper, VideoCamera, Image as ImageIcon, Gear, Heartbeat } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { ArtistsManager } from './ArtistsManager'
import { ReleasesManager } from './ReleasesManager'
import { NewsManager } from './NewsManager'
import { VideosManager } from './VideosManager'
import { AssetsManager } from './AssetsManager'
import { SiteSettingsManager } from './SiteSettingsManager'
import { SystemHealthWidget } from './SystemHealthWidget'

export function AdminDashboard() {
  const { user, profile, signOut, session } = useAuthContext()
  const [activeTab, setActiveTab] = useState('artists')

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (error) {
      toast.error('Failed to sign out')
    } else {
      toast.success('Signed out successfully')
    }
  }

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
              <SignOut size={16} weight="bold" className="mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:inline-grid">
            <TabsTrigger value="artists" className="gap-2">
              <User size={16} weight="bold" />
              Artists
            </TabsTrigger>
            <TabsTrigger value="releases" className="gap-2">
              <MusicNotes size={16} weight="bold" />
              Releases
            </TabsTrigger>
            <TabsTrigger value="news" className="gap-2">
              <Newspaper size={16} weight="bold" />
              News
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-2">
              <VideoCamera size={16} weight="bold" />
              Videos
            </TabsTrigger>
            <TabsTrigger value="assets" className="gap-2">
              <ImageIcon size={16} weight="bold" />
              Assets
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Gear size={16} weight="bold" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-2">
              <Heartbeat size={16} weight="bold" />
              Health
            </TabsTrigger>
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

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Site Settings</CardTitle>
                <CardDescription>
                  Manage global site content: social links, hero text, SEO metadata, and more
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SiteSettingsManager />
              </CardContent>
            </Card>
          </TabsContent>

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
        </Tabs>
      </main>
    </div>
  )
}
