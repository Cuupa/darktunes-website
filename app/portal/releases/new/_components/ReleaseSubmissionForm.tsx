'use client'

import { useTranslations } from 'next-intl'
import { useState, useCallback } from 'react'
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
import { CoverArtAnalyzer } from '@/components/portal/CoverArtAnalyzer'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Artist, SubmissionFormField } from '@/types'

interface ReleaseSubmissionFormProps {
  artist: Artist | null
  formSchema: SubmissionFormField[]
}

type ReleaseType = 'album' | 'ep' | 'single'

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: SubmissionFormField
  value: string
  onChange: (v: string) => void
}) {
  const label = field.fieldLabelEn
  const placeholder = field.placeholderEn ?? ''
  const id = `dynamic-${field.fieldKey}`

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {field.isRequired && <span className="text-destructive ml-1">*</span>}
      </Label>
      {field.fieldType === 'textarea' ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={field.isRequired}
        />
      ) : (
        <Input
          id={id}
          type={field.fieldType === 'url' ? 'url' : field.fieldType === 'date' ? 'date' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={field.isRequired}
        />
      )}
    </div>
  )
}

export function ReleaseSubmissionForm({ artist, formSchema }: ReleaseSubmissionFormProps) {
  const t = useTranslations('portal')

  const router = useRouter()
  const [title, setTitle] = useState(artist?.name ?? '')
  const [releaseDate, setReleaseDate] = useState('')
  const [type, setType] = useState<ReleaseType>('single')
  const [audioDownloadUrl, setAudioDownloadUrl] = useState('')
  const [coverArtUrl, setCoverArtUrl] = useState('')
  const [coverArtVerified, setCoverArtVerified] = useState(false)
  const [genre, setGenre] = useState(artist?.genres?.[0] ?? '')
  const [catalogNumber, setCatalogNumber] = useState('')
  const [isrc, setIsrc] = useState('')
  const [labelCopy, setLabelCopy] = useState('')
  const [spotifyUrl, setSpotifyUrl] = useState(artist?.spotifyUrl ?? '')
  const [appleMusicUrl, setAppleMusicUrl] = useState(artist?.appleMusicUrl ?? '')
  const [youtubeUrl, setYoutubeUrl] = useState(artist?.youtubeUrl ?? '')
  const [notes, setNotes] = useState('')
  const [dynamicValues, setDynamicValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const FIXED_KEYS = new Set([
    'title', 'release_date', 'type', 'audio_download_url', 'cover_art_url',
    'genre', 'catalog_number', 'isrc', 'label_copy', 'spotify_url',
    'apple_music_url', 'youtube_url', 'notes',
  ])
  const extraFields = formSchema.filter((f) => f.isVisible && !FIXED_KEYS.has(f.fieldKey))

  const handleCoverArtVerified = useCallback((verified: boolean) => {
    setCoverArtVerified(verified)
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!coverArtVerified) {
      toast.error(t('releases_submit_cover_check_required'))
      return
    }

    setSubmitting(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error(t('releases_submit_error'))
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
          releaseDate: releaseDate || null,
          type,
          audioDownloadUrl,
          coverArtUrl,
          coverArtVerified,
          genre: genre || null,
          catalogNumber: catalogNumber || null,
          isrc: isrc || null,
          labelCopy: labelCopy || null,
          spotifyUrl: spotifyUrl || null,
          appleMusicUrl: appleMusicUrl || null,
          youtubeUrl: youtubeUrl || null,
          notes: notes || null,
          formData: Object.keys(dynamicValues).length > 0 ? dynamicValues : null,
        }),
      })

      if (!res.ok) {
        toast.error(t('releases_submit_error'))
        return
      }

      toast.success(t('releases_submit_success'))
      router.push('/portal/releases/submissions')
      router.refresh()
    } catch {
      toast.error(t('releases_submit_error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('releases_submit_heading')}</h1>
      <p className="text-sm text-muted-foreground">{t('releases_submit_pending_notice')}</p>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>{t('releases_submit_heading')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => void submit(e)}>
            <div className="space-y-2">
              <Label htmlFor="release-title">
                {t('releases_submit_title')}
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input id="release-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="release-date">{t('releases_submit_date')}</Label>
                <Input id="release-date" type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>
                  {t('releases_submit_type')}
                  <span className="text-destructive ml-1">*</span>
                </Label>
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
              <Label htmlFor="audio-url">
                {t('releases_submit_audio_url')}
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input
                id="audio-url"
                type="url"
                value={audioDownloadUrl}
                onChange={(e) => setAudioDownloadUrl(e.target.value)}
                placeholder="https://drive.google.com/…"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cover-art-url">
                {t('releases_submit_cover_url')}
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Input
                id="cover-art-url"
                type="url"
                value={coverArtUrl}
                onChange={(e) => {
                  setCoverArtUrl(e.target.value)
                  setCoverArtVerified(false)
                }}
                placeholder="https://drive.google.com/…"
                required
              />
              <CoverArtAnalyzer url={coverArtUrl} onVerified={handleCoverArtVerified} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="genre">{t('releases_submit_genre')}</Label>
              <Input id="genre" value={genre} onChange={(e) => setGenre(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="catalog-number">{t('releases_submit_catalog_number')}</Label>
                <Input id="catalog-number" value={catalogNumber} onChange={(e) => setCatalogNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="isrc">{t('releases_submit_isrc')}</Label>
                <Input id="isrc" value={isrc} onChange={(e) => setIsrc(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="label-copy">{t('releases_submit_label_copy')}</Label>
              <Input id="label-copy" value={labelCopy} onChange={(e) => setLabelCopy(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="spotify-url">{t('releases_submit_spotify')}</Label>
              <Input id="spotify-url" type="url" value={spotifyUrl} onChange={(e) => setSpotifyUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apple-url">{t('releases_submit_apple')}</Label>
              <Input id="apple-url" type="url" value={appleMusicUrl} onChange={(e) => setAppleMusicUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="youtube-url">{t('releases_submit_youtube')}</Label>
              <Input id="youtube-url" type="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="release-notes">{t('releases_submit_notes')}</Label>
              <Textarea id="release-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {extraFields.map((field) => (
              <DynamicField
                key={field.id}
                field={field}
                value={dynamicValues[field.fieldKey] ?? ''}
                onChange={(v) => setDynamicValues((prev) => ({ ...prev, [field.fieldKey]: v }))}
              />
            ))}

            <Button
              type="submit"
              disabled={submitting || !coverArtVerified}
              title={!coverArtVerified ? t('releases_submit_cover_check_required') : undefined}
            >
              {submitting ? t('releases_submit_saving') : t('releases_submit_save')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
