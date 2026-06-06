'use client'

/**
 * src/components/admin/JournalistManager.tsx
 *
 * Admin interface for:
 *   1. Reviewing and approving/rejecting journalist applications
 *   2. Uploading press photos (EPK) via the /api/upload-epk server-side route
 *   3. Uploading promo tracks via the /api/upload-epk server-side route
 *
 * Upload flow routes files through Next.js to avoid the CORS restriction that
 * prevented direct browser → r2.cloudflarestorage.com presigned uploads.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import Image from 'next/image'
import {
  CheckCircle,
  XCircle,
  HourglassMedium,
  CloudArrowUp,
  Trash,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { getPressPhotos, createPressPhoto, deletePressPhoto } from '@/lib/api/pressPhotos'
import { getPromoTracks, createPromoTrack, deletePromoTrack } from '@/lib/api/promoTracks'
import type { JournalistApplication } from '@/lib/api/journalistApplications'
import type { PressPhoto } from '@/lib/api/pressPhotos'
import type { PromoTrack } from '@/lib/api/promoTracks'
import { useDict } from '@/contexts/DictContext'
import { getErrorMessage } from '@/lib/clientErrors'
import type { ApiErrorResponse } from '@/lib/errors'

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') {
    return <Badge className="bg-green-700 text-green-100">Approved</Badge>
  }
  if (status === 'rejected') {
    return <Badge variant="destructive">Rejected</Badge>
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <HourglassMedium size={12} />
      Pending
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function JournalistManager() {
  const dict = useDict()
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])

  const [applications, setApplications] = useState<JournalistApplication[]>([])
  const [photos, setPhotos] = useState<PressPhoto[]>([])
  const [tracks, setTracks] = useState<PromoTrack[]>([])
  const [loading, setLoading] = useState(true)

  // Press photo form
  const [photoTitle, setPhotoTitle] = useState('')
  const [photoAlt, setPhotoAlt] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)

  // Promo track form
  const [trackTitle, setTrackTitle] = useState('')
  const [trackArtist, setTrackArtist] = useState('')
  const [trackFile, setTrackFile] = useState<File | null>(null)
  const [trackUploading, setTrackUploading] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [appsRes, photosData, tracksData] = await Promise.all([
      fetch('/api/journalist-applications')
        .then((r) => r.json())
        .catch(() => ({ applications: [] })),
      getPressPhotos(supabase).catch(() => []),
      getPromoTracks(supabase).catch(() => []),
    ])
    setApplications(appsRes.applications ?? [])
    setPhotos(photosData)
    setTracks(tracksData)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ---------------------------------------------------------------------------
  // Application actions
  // ---------------------------------------------------------------------------

  const handleApplicationAction = async (id: string, status: 'approved' | 'rejected') => {
    const res = await fetch(`/api/journalist-applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      toast.success(`Application ${status}`)
      fetchAll()
    } else {
      toast.error(dict.errors.SERVER_ERROR)
    }
  }

  // ---------------------------------------------------------------------------
  // Press photo upload
  // ---------------------------------------------------------------------------

  const handlePhotoUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!photoFile || !photoTitle) return
    setPhotoUploading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const form = new FormData()
      form.append('file', photoFile)
      form.append('category', 'press-photos')

      const uploadRes = await fetch('/api/upload-epk', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      })
      if (!uploadRes.ok) {
        const err = (await uploadRes.json().catch(() => ({}) )) as { error?: string }
        throw new Error(getErrorMessage(err as ApiErrorResponse, dict))
      }
      const { r2Key, publicUrl } = (await uploadRes.json()) as { r2Key: string; publicUrl: string }

      await createPressPhoto(supabase, {
        title: photoTitle,
        alt_text: photoAlt || null,
        r2_key: r2Key,
        public_url: publicUrl,
      })
      toast.success('Photo uploaded')
      setPhotoTitle('')
      setPhotoAlt('')
      setPhotoFile(null)
      fetchAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.errors.SERVER_ERROR)
    } finally {
      setPhotoUploading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Promo track upload
  // ---------------------------------------------------------------------------

  const handleTrackUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trackFile || !trackTitle || !trackArtist) return
    setTrackUploading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const form = new FormData()
      form.append('file', trackFile)
      form.append('category', 'promo-tracks')

      const uploadRes = await fetch('/api/upload-epk', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      })
      if (!uploadRes.ok) {
        const err = (await uploadRes.json().catch(() => ({}) )) as { error?: string }
        throw new Error(getErrorMessage(err as ApiErrorResponse, dict))
      }
      const { r2Key } = (await uploadRes.json()) as { r2Key: string; publicUrl: string }

      await createPromoTrack(supabase, {
        title: trackTitle,
        artist_name: trackArtist,
        r2_key: r2Key,
        file_size_bytes: trackFile.size,
      })
      toast.success('Track uploaded')
      setTrackTitle('')
      setTrackArtist('')
      setTrackFile(null)
      fetchAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : dict.errors.SERVER_ERROR)
    } finally {
      setTrackUploading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* ── Journalist Applications ───────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Journalist Applications</CardTitle>
          <CardDescription>Review and approve promo pool access requests</CardDescription>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <p className="text-muted-foreground text-sm">No applications yet.</p>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded border border-border"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {app.name}
                      <span className="text-muted-foreground font-normal"> — {app.outlet}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">{app.email}</p>
                    {app.message && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{app.message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={app.status} />
                    {app.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-green-400 border-green-400 hover:bg-green-400/10"
                          onClick={() => handleApplicationAction(app.id, 'approved')}
                        >
                          <CheckCircle size={14} weight="bold" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-destructive border-destructive hover:bg-destructive/10"
                          onClick={() => handleApplicationAction(app.id, 'rejected')}
                        >
                          <XCircle size={14} weight="bold" />
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Press Photos ─────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Press Photos</CardTitle>
          <CardDescription>Upload high-resolution press photos for the public EPK page</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handlePhotoUpload} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="photo-title">Title</Label>
              <Input
                id="photo-title"
                value={photoTitle}
                onChange={(e) => setPhotoTitle(e.target.value)}
                required
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="photo-alt">Alt Text</Label>
              <Input
                id="photo-alt"
                value={photoAlt}
                onChange={(e) => setPhotoAlt(e.target.value)}
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="photo-file">Image File</Label>
              <Input
                id="photo-file"
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                required
                className="bg-background border-input"
              />
            </div>
            <Button
              type="submit"
              disabled={photoUploading}
              className="gap-2 sm:col-span-2 w-full sm:w-auto"
            >
              <CloudArrowUp size={16} weight="bold" />
              {photoUploading ? 'Uploading…' : 'Upload Photo'}
            </Button>
          </form>

          {photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative group rounded overflow-hidden border border-border"
                >
                  <Image
                    src={photo.publicUrl}
                    alt={photo.altText ?? photo.title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        deletePressPhoto(supabase, photo.id)
                          .then(fetchAll)
                          .catch(() => toast.error(dict.errors.SERVER_ERROR))
                      }}
                      aria-label={`Delete ${photo.title}`}
                    >
                      <Trash size={14} weight="bold" />
                    </Button>
                  </div>
                  <p className="text-xs p-1 truncate">{photo.title}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Promo Tracks ─────────────────────────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Promo Tracks</CardTitle>
          <CardDescription>
            Upload private pre-release audio for verified journalists (stored securely in R2)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleTrackUpload} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="track-title">Track Title</Label>
              <Input
                id="track-title"
                value={trackTitle}
                onChange={(e) => setTrackTitle(e.target.value)}
                required
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="track-artist">Artist Name</Label>
              <Input
                id="track-artist"
                value={trackArtist}
                onChange={(e) => setTrackArtist(e.target.value)}
                required
                className="bg-background border-input"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="track-file">Audio File (WAV / MP3)</Label>
              <Input
                id="track-file"
                type="file"
                accept="audio/*"
                onChange={(e) => setTrackFile(e.target.files?.[0] ?? null)}
                required
                className="bg-background border-input"
              />
            </div>
            <Button
              type="submit"
              disabled={trackUploading}
              className="gap-2 sm:col-span-2 w-full sm:w-auto"
            >
              <CloudArrowUp size={16} weight="bold" />
              {trackUploading ? 'Uploading…' : 'Upload Track'}
            </Button>
          </form>

          {tracks.length > 0 && (
            <div className="space-y-2 pt-4">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="flex items-center justify-between p-3 rounded border border-border"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{track.title}</p>
                    <p className="text-sm text-muted-foreground">{track.artistName}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      deletePromoTrack(supabase, track.id)
                        .then(fetchAll)
                        .catch(() => toast.error(dict.errors.SERVER_ERROR))
                    }}
                    aria-label={`Delete ${track.title}`}
                  >
                    <Trash size={14} weight="bold" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
