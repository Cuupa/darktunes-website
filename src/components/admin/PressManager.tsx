'use client'

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { CloudArrowUp, DownloadSimple, Headphones, Image as ImageIcon, Newspaper, TrendUp, Users, FolderOpen } from '@phosphor-icons/react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { getArtists } from '@/lib/api/artists'
import { getPressPhotos, createPressPhoto, deletePressPhoto } from '@/lib/api/pressPhotos'
import { getPromoTracks, createPromoTrack, deletePromoTrack } from '@/lib/api/promoTracks'
import type { JournalistApplication } from '@/lib/api/journalistApplications'
import type { PressPhoto } from '@/lib/api/pressPhotos'
import type { PromoTrack } from '@/lib/api/promoTracks'
import { listRequests } from '@/lib/api/accreditations'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

const AccreditationsManager = lazy(() => import('./AccreditationsManager').then((m) => ({ default: m.AccreditationsManager })))
const MediaFileExplorer = lazy(() => import('./media-explorer/MediaFileExplorer').then((m) => ({ default: m.MediaFileExplorer })))

function PanelFallback() {
  return <Skeleton className="h-40 w-full" />
}

export function PressManager() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [applications, setApplications] = useState<JournalistApplication[]>([])
  const [photos, setPhotos] = useState<PressPhoto[]>([])
  const [tracks, setTracks] = useState<PromoTrack[]>([])
  const [artists, setArtists] = useState<Array<{ id: string; name: string }>>([])
  const [accreditationCount, setAccreditationCount] = useState(0)
  const [downloadCount, setDownloadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [photoForm, setPhotoForm] = useState({ title: '', alt: '', category: 'photo', artistId: '' })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)

  const [trackForm, setTrackForm] = useState({
    title: '',
    artistName: '',
    genre: '',
    bpm: '',
    key: '',
    releaseDate: '',
    embargoUntil: '',
    ndaRequired: false,
  })
  const [trackFile, setTrackFile] = useState<File | null>(null)
  const [trackUploading, setTrackUploading] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [appsRes, photoRows, trackRows, artistRows, accreditationRows, downloadRows] = await Promise.all([
        fetch('/api/journalist-applications').then((response) => response.json()).catch(() => ({ applications: [] })),
        getPressPhotos(supabase).catch(() => []),
        getPromoTracks(supabase).catch(() => []),
        getArtists(supabase).catch(() => []),
        listRequests(supabase).catch(() => []),
        supabase.from('journalist_downloads').select('id', { count: 'exact', head: false }).then(({ data }) => data ?? [], () => []),
      ])
      setApplications(appsRes.applications ?? [])
      setPhotos(photoRows)
      setTracks(trackRows)
      setArtists(artistRows.map((artist) => ({ id: artist.id, name: artist.name })))
      setAccreditationCount(accreditationRows.length)
      setDownloadCount(downloadRows.length)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const approveApplication = async (id: string, status: 'approved' | 'rejected') => {
    const response = await fetch(`/api/journalist-applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!response.ok) {
      toast.error('Failed to update application')
      return
    }
    toast.success(`Application ${status}`)
    await loadAll()
  }

  const uploadPhoto = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!photoFile || !photoForm.title) return
    setPhotoUploading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const form = new FormData()
      form.append('file', photoFile)
      form.append('category', 'press-photos')
      const uploadRes = await fetch('/api/upload-epk', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.access_token },
        body: form,
      })
      if (!uploadRes.ok) throw new Error('Upload failed')
      const { r2Key, publicUrl } = (await uploadRes.json()) as { r2Key: string; publicUrl: string }

      await createPressPhoto(supabase, {
        title: photoForm.title,
        alt_text: photoForm.alt || null,
        r2_key: r2Key,
        public_url: publicUrl,
        category: photoForm.category,
        artist_id: photoForm.artistId || null,
      })
      setPhotoForm({ title: '', alt: '', category: 'photo', artistId: '' })
      setPhotoFile(null)
      toast.success('Press asset uploaded')
      await loadAll()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setPhotoUploading(false)
    }
  }

  const uploadTrack = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!trackFile || !trackForm.title || !trackForm.artistName) return
    setTrackUploading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const form = new FormData()
      form.append('file', trackFile)
      form.append('category', 'promo-tracks')
      const uploadRes = await fetch('/api/upload-epk', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.access_token },
        body: form,
      })
      if (!uploadRes.ok) throw new Error('Upload failed')
      const { r2Key } = (await uploadRes.json()) as { r2Key: string }

      await createPromoTrack(supabase, {
        title: trackForm.title,
        artist_name: trackForm.artistName,
        r2_key: r2Key,
        file_size_bytes: trackFile.size,
        genre: trackForm.genre || null,
        bpm: trackForm.bpm ? Number(trackForm.bpm) : null,
        key: trackForm.key || null,
        release_date: trackForm.releaseDate || null,
        nda_required: trackForm.ndaRequired,
        embargo_until: trackForm.embargoUntil ? new Date(trackForm.embargoUntil).toISOString() : null,
      })
      setTrackForm({ title: '', artistName: '', genre: '', bpm: '', key: '', releaseDate: '', embargoUntil: '', ndaRequired: false })
      setTrackFile(null)
      toast.success('Promo track uploaded')
      await loadAll()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setTrackUploading(false)
    }
  }

  if (loading) {
    return <Skeleton className="h-64 w-full" />
  }

  return (
    <Tabs defaultValue="applications" className="space-y-4">
      <TabsList className="flex h-auto flex-wrap gap-1 p-1">
        <TabsTrigger value="applications" className="gap-2"><Users size={16} weight="bold" aria-hidden="true" />Applications</TabsTrigger>
        <TabsTrigger value="photos" className="gap-2"><ImageIcon size={16} weight="bold" aria-hidden="true" />Press Photos</TabsTrigger>
        <TabsTrigger value="tracks" className="gap-2"><Headphones size={16} weight="bold" aria-hidden="true" />Promo Tracks</TabsTrigger>
        <TabsTrigger value="media" className="gap-2"><FolderOpen size={16} weight="bold" aria-hidden="true" />Media</TabsTrigger>
        <TabsTrigger value="accreditations" className="gap-2"><Newspaper size={16} weight="bold" aria-hidden="true" />Accreditations</TabsTrigger>
        <TabsTrigger value="analytics" className="gap-2"><TrendUp size={16} weight="bold" aria-hidden="true" />Analytics</TabsTrigger>
      </TabsList>

      <TabsContent value="applications">
        <div className="space-y-3">
          {applications.map((application) => (
            <Card key={application.id} className="border-border bg-card/70">
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">{application.name} — {application.outlet}</p>
                  <p className="text-sm text-muted-foreground">{application.email}</p>
                  {application.message && <p className="mt-1 text-sm text-muted-foreground">{application.message}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void approveApplication(application.id, 'approved')}>Approve</Button>
                  <Button size="sm" variant="destructive" onClick={() => void approveApplication(application.id, 'rejected')}>Reject</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {applications.length === 0 && <p className="text-sm text-muted-foreground">No journalist applications yet.</p>}
        </div>
      </TabsContent>

      <TabsContent value="photos" className="space-y-4">
        <Card className="border-border bg-card/70">
          <CardHeader>
            <CardTitle>Upload press asset</CardTitle>
            <CardDescription>Photos, logos, socials, or documents for the press kit.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={uploadPhoto} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="press-photo-title">Title</Label><Input id="press-photo-title" value={photoForm.title} onChange={(e) => setPhotoForm((v) => ({ ...v, title: e.target.value }))} required /></div>
              <div className="space-y-2"><Label htmlFor="press-photo-alt">Alt text</Label><Input id="press-photo-alt" value={photoForm.alt} onChange={(e) => setPhotoForm((v) => ({ ...v, alt: e.target.value }))} /></div>
              <div className="space-y-2">
                <Label htmlFor="press-photo-category">Category</Label>
                <Select value={photoForm.category} onValueChange={(value) => setPhotoForm((v) => ({ ...v, category: value }))}>
                  <SelectTrigger id="press-photo-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="photo">Photo</SelectItem>
                    <SelectItem value="logo">Logo</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="press-photo-artist">Artist</Label>
                <Select value={photoForm.artistId || '__all__'} onValueChange={(value) => setPhotoForm((v) => ({ ...v, artistId: value === '__all__' ? '' : value }))}>
                  <SelectTrigger id="press-photo-artist"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All artists</SelectItem>
                    {artists.map((artist) => <SelectItem key={artist.id} value={artist.id}>{artist.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2"><Label htmlFor="press-photo-file">File</Label><Input id="press-photo-file" type="file" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} required /></div>
              <div className="md:col-span-2"><Button type="submit" disabled={photoUploading} className="gap-2"><CloudArrowUp size={16} weight="bold" aria-hidden="true" />{photoUploading ? 'Uploading…' : 'Upload asset'}</Button></div>
            </form>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo) => (
            <Card key={photo.id} className="overflow-hidden border-border bg-card/70">
              <div className="relative aspect-square overflow-hidden">
                <Image src={photo.publicUrl} alt={photo.altText ?? photo.title} fill className="object-cover" unoptimized />
              </div>
              <CardContent className="space-y-3 p-4">
                <div>
                  <p className="font-medium">{photo.title}</p>
                  <p className="text-sm text-muted-foreground">{photo.category}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" asChild><a href={photo.publicUrl} target="_blank" rel="noopener noreferrer"><DownloadSimple size={16} weight="bold" aria-hidden="true" />Open</a></Button>
                  <Button size="sm" variant="destructive" onClick={() => deletePressPhoto(supabase, photo.id).then(loadAll).catch(() => toast.error('Delete failed'))}>Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="tracks" className="space-y-4">
        <Card className="border-border bg-card/70">
          <CardHeader>
            <CardTitle>Upload promo track</CardTitle>
            <CardDescription>Private journalist-only audio with metadata and NDA support.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={uploadTrack} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="promo-track-title">Title</Label><Input id="promo-track-title" value={trackForm.title} onChange={(e) => setTrackForm((v) => ({ ...v, title: e.target.value }))} required /></div>
              <div className="space-y-2"><Label htmlFor="promo-track-artist">Artist Name</Label><Input id="promo-track-artist" value={trackForm.artistName} onChange={(e) => setTrackForm((v) => ({ ...v, artistName: e.target.value }))} required /></div>
              <div className="space-y-2"><Label htmlFor="promo-track-genre">Genre</Label><Input id="promo-track-genre" value={trackForm.genre} onChange={(e) => setTrackForm((v) => ({ ...v, genre: e.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="promo-track-bpm">BPM</Label><Input id="promo-track-bpm" type="number" min="0" value={trackForm.bpm} onChange={(e) => setTrackForm((v) => ({ ...v, bpm: e.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="promo-track-key">Key</Label><Input id="promo-track-key" value={trackForm.key} onChange={(e) => setTrackForm((v) => ({ ...v, key: e.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="promo-track-release-date">Release date</Label><Input id="promo-track-release-date" type="date" value={trackForm.releaseDate} onChange={(e) => setTrackForm((v) => ({ ...v, releaseDate: e.target.value }))} /></div>
              <div className="space-y-2"><Label htmlFor="promo-track-embargo">Embargo until</Label><Input id="promo-track-embargo" type="datetime-local" value={trackForm.embargoUntil} onChange={(e) => setTrackForm((v) => ({ ...v, embargoUntil: e.target.value }))} /></div>
              <div className="flex items-center gap-2 pt-8"><Checkbox id="promo-track-nda" checked={trackForm.ndaRequired} onCheckedChange={(value) => setTrackForm((v) => ({ ...v, ndaRequired: value === true }))} /><Label htmlFor="promo-track-nda">NDA required</Label></div>
              <div className="space-y-2 md:col-span-2"><Label htmlFor="promo-track-file">Audio file</Label><Input id="promo-track-file" type="file" accept="audio/*" onChange={(e) => setTrackFile(e.target.files?.[0] ?? null)} required /></div>
              <div className="md:col-span-2"><Button type="submit" disabled={trackUploading} className="gap-2"><CloudArrowUp size={16} weight="bold" aria-hidden="true" />{trackUploading ? 'Uploading…' : 'Upload track'}</Button></div>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-3">
          {tracks.map((track) => (
            <Card key={track.id} className="border-border bg-card/70">
              <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">{track.title} — {track.artistName}</p>
                  <p className="text-sm text-muted-foreground">{[track.genre, track.bpm ? `${track.bpm} BPM` : null, track.key].filter(Boolean).join(' · ') || 'No metadata'}</p>
                </div>
                <Button size="sm" variant="destructive" onClick={() => deletePromoTrack(supabase, track.id).then(loadAll).catch(() => toast.error('Delete failed'))}>Delete</Button>
              </CardContent>
            </Card>
          ))}
          {tracks.length === 0 && <p className="text-sm text-muted-foreground">No promo tracks uploaded yet.</p>}
        </div>
      </TabsContent>

      <TabsContent value="accreditations">
        <Suspense fallback={<PanelFallback />}>
          <AccreditationsManager />
        </Suspense>
      </TabsContent>

      <TabsContent value="media">
        <Suspense fallback={<PanelFallback />}>
          <MediaFileExplorer className="min-h-[500px]" />
        </Suspense>
      </TabsContent>

      <TabsContent value="analytics">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-border bg-card/70"><CardHeader><CardTitle>Applications</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{applications.length}</p></CardContent></Card>
          <Card className="border-border bg-card/70"><CardHeader><CardTitle>Press Assets</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{photos.length}</p></CardContent></Card>
          <Card className="border-border bg-card/70"><CardHeader><CardTitle>Promo Tracks</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{tracks.length}</p></CardContent></Card>
          <Card className="border-border bg-card/70"><CardHeader><CardTitle>Accreditations</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{accreditationCount}</p></CardContent></Card>
          <Card className="border-border bg-card/70 md:col-span-2 xl:col-span-4"><CardHeader><CardTitle>Total journalist downloads</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{downloadCount}</p></CardContent></Card>
        </div>
      </TabsContent>
    </Tabs>
  )
}
