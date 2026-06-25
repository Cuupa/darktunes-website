'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

const YT_CATEGORIES = [
  { value: '10', label: 'Music' },
  { value: '24', label: 'Entertainment' },
  { value: '22', label: 'People & Blogs' },
  { value: '27', label: 'Education' },
]

export function VideoSubmissionForm() {
  const t = useTranslations('portal')
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [youtubeTitle, setYoutubeTitle] = useState('')
  const [youtubeDescription, setYoutubeDescription] = useState('')
  const [youtubeTags, setYoutubeTags] = useState('')
  const [youtubeCategory, setYoutubeCategory] = useState('10')
  const [targetPublishDate, setTargetPublishDate] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error(t('video_submit_error'))
        return
      }

      const res = await fetch('/api/portal/submit-video', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          downloadUrl,
          thumbnailUrl: thumbnailUrl || null,
          youtubeTitle: youtubeTitle.trim(),
          youtubeDescription: youtubeDescription.trim(),
          youtubeTags: youtubeTags.split(',').map((t) => t.trim()).filter(Boolean),
          youtubeCategory: youtubeCategory || null,
          targetPublishDate: targetPublishDate || null,
          notes: notes || null,
        }),
      })

      if (!res.ok) {
        toast.error(t('video_submit_error'))
        return
      }

      toast.success(t('video_submit_success'))
      router.push('/portal/releases/videos')
      router.refresh()
    } catch {
      toast.error(t('video_submit_error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('video_submit_heading')}</h1>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{t('video_submit_heading')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => void submit(e)}>
            <div className="space-y-2">
              <Label htmlFor="video-title">
                {t('video_submit_title')}
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input id="video-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="download-url">
                {t('video_submit_download_url')}
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input id="download-url" type="url" value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)} placeholder="https://drive.google.com/…" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="thumbnail-url">{t('video_submit_thumbnail_url')}</Label>
              <Input id="thumbnail-url" type="url" value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="yt-title">
                {t('video_submit_yt_title')}
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input id="yt-title" value={youtubeTitle} onChange={(e) => setYoutubeTitle(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="yt-description">
                {t('video_submit_yt_description')}
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Textarea id="yt-description" value={youtubeDescription} onChange={(e) => setYoutubeDescription(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="yt-tags">{t('video_submit_yt_tags')}</Label>
              <Input id="yt-tags" value={youtubeTags} onChange={(e) => setYoutubeTags(e.target.value)} placeholder="electronic, dark techno, techno" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="yt-category">{t('video_submit_yt_category')}</Label>
              <select
                id="yt-category"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={youtubeCategory}
                onChange={(e) => setYoutubeCategory(e.target.value)}
              >
                {YT_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="publish-date">{t('video_submit_publish_date')}</Label>
              <Input id="publish-date" type="date" value={targetPublishDate} onChange={(e) => setTargetPublishDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="video-notes">{t('video_submit_notes')}</Label>
              <Textarea id="video-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting ? t('video_submit_saving') : t('video_submit_save')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
