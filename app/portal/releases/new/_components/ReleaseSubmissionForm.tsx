'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Dictionary } from '@/i18n/types'

interface ReleaseSubmissionFormProps {
  dict: Dictionary['portal']
}

type ReleaseType = 'album' | 'ep' | 'single'

export function ReleaseSubmissionForm({ dict }: ReleaseSubmissionFormProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [releaseDate, setReleaseDate] = useState('')
  const [type, setType] = useState<ReleaseType>('single')
  const [spotifyUrl, setSpotifyUrl] = useState('')
  const [appleMusicUrl, setAppleMusicUrl] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [coverArtUrl, setCoverArtUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadCover = async (file: File) => {
    setUploadingCover(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        toast.error(dict.releases_submit_error)
        return
      }

      const body = new FormData()
      body.append('file', file)

      const res = await fetch('/api/portal/upload-release-cover', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
      })

      if (!res.ok) {
        toast.error(dict.releases_submit_error)
        return
      }

      const payload = (await res.json()) as { url: string }
      setCoverArtUrl(payload.url)
    } catch {
      toast.error(dict.releases_submit_error)
    } finally {
      setUploadingCover(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !releaseDate || !type) {
      toast.error(dict.releases_submit_error)
      return
    }

    setSubmitting(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        toast.error(dict.releases_submit_error)
        return
      }

      const res = await fetch('/api/portal/submit-release', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          releaseDate,
          type,
          coverArt: coverArtUrl || null,
          spotifyUrl: spotifyUrl || null,
          appleMusicUrl: appleMusicUrl || null,
          youtubeUrl: youtubeUrl || null,
          notes: notes || null,
        }),
      })

      if (!res.ok) {
        toast.error(dict.releases_submit_error)
        return
      }

      toast.success(dict.releases_submit_success)
      router.push('/portal/releases')
      router.refresh()
    } catch {
      toast.error(dict.releases_submit_error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{dict.releases_submit_heading}</h1>
      <p className="text-sm text-muted-foreground">{dict.releases_submit_pending_notice}</p>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{dict.releases_submit_heading}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="release-title">{dict.releases_submit_title}</Label>
              <Input id="release-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="release-date">{dict.releases_submit_date}</Label>
                <Input id="release-date" type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>{dict.releases_submit_type}</Label>
                <Select value={type} onValueChange={(val) => setType(val as ReleaseType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="album">Album</SelectItem>
                    <SelectItem value="ep">EP</SelectItem>
                    <SelectItem value="single">Single</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="release-cover-file">{dict.releases_submit_cover}</Label>
              <input
                id="release-cover-file"
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void uploadCover(file)
                }}
              />
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingCover}>
                  {uploadingCover ? dict.releases_submit_saving : dict.releases_submit_cover}
                </Button>
                {coverArtUrl && <span className="text-xs text-muted-foreground truncate">{coverArtUrl}</span>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="spotify-url">{dict.releases_submit_spotify}</Label>
              <Input id="spotify-url" type="url" value={spotifyUrl} onChange={(e) => setSpotifyUrl(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apple-url">{dict.releases_submit_apple}</Label>
              <Input id="apple-url" type="url" value={appleMusicUrl} onChange={(e) => setAppleMusicUrl(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="youtube-url">{dict.releases_submit_youtube}</Label>
              <Input id="youtube-url" type="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="release-notes">{dict.releases_submit_notes}</Label>
              <Textarea id="release-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <Button type="submit" disabled={submitting || uploadingCover}>
              {submitting ? dict.releases_submit_saving : dict.releases_submit_save}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
