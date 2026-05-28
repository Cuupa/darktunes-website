'use client'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { AdminPanelProps } from '@/lib/component-contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ArrowsClockwise, MagnifyingGlass } from '@phosphor-icons/react'
import { extractYouTubeVideoId } from '@/lib/parsers/platformUrlParser'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Artist } from '@/types'
import { ImageUploadButton } from './ImageUploadButton'

export interface VideoFormData {
  title: string
  artistName: string
  youtubeId: string
  thumbnailUrl: string
  publishedAt: string
  isVisible: boolean
  isShort: boolean
}

type Props = AdminPanelProps<VideoFormData> & { artists?: Artist[] }

/** Extracts a YouTube video ID from a URL or returns null if unrecognised. */
// Uses the centralized parser from platformUrlParser.ts
const localExtractYouTubeId = extractYouTubeVideoId

export function VideoForm({ value, onChange, isLoading, artists }: Props) {
  const supabase = createBrowserSupabaseClient()
  const { register, handleSubmit, watch, setValue, reset } = useForm<VideoFormData>({
    defaultValues: value,
  })
  const [isFetchingInfo, setIsFetchingInfo] = useState(false)
  const [artistSearch, setArtistSearch] = useState('')

  useEffect(() => {
    reset(value)
  }, [value, reset])

  const youtubeIdField = watch('youtubeId')
  const thumbnailUrl = watch('thumbnailUrl')
  const isVisible = watch('isVisible')
  const isShort = watch('isShort')

  // Auto-extract YouTube ID when the user pastes a full URL
  const lastParsed = useRef('')
  useEffect(() => {
    const raw = youtubeIdField ?? ''
    if (raw === lastParsed.current) return
    // Only attempt extraction if the value looks like a URL (contains '/')
    if (raw.includes('/')) {
      const extracted = localExtractYouTubeId(raw)
      if (extracted && extracted !== raw) {
        lastParsed.current = extracted
        setValue('youtubeId', extracted)
        return
      }
    }
    lastParsed.current = raw
  }, [youtubeIdField, setValue])

  // Auto-set thumbnail when youtubeId changes and thumbnail is empty
  useEffect(() => {
    const id = youtubeIdField?.trim()
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id) && !thumbnailUrl) {
      setValue('thumbnailUrl', `https://img.youtube.com/vi/${id}/maxresdefault.jpg`)
    }
  }, [youtubeIdField, thumbnailUrl, setValue])

  const handleFetchInfo = async () => {
    const rawInput = youtubeIdField?.trim()
    if (!rawInput) {
      toast.error('Enter a YouTube URL or video ID first')
      return
    }
    setIsFetchingInfo(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/fetch-youtube-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ youtubeUrl: rawInput }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      const info = (await res.json()) as {
        videoId: string
        title: string
        channelTitle: string
        thumbnailUrl: string
      }

      setValue('youtubeId', info.videoId)
      if (info.title) setValue('title', info.title)
      if (info.channelTitle) setValue('artistName', info.channelTitle)
      if (info.thumbnailUrl) setValue('thumbnailUrl', info.thumbnailUrl)
      toast.success('Video info fetched from YouTube')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch YouTube info')
    } finally {
      setIsFetchingInfo(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onChange)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="youtubeId">YouTube URL or Video ID *</Label>
        <div className="flex gap-2">
          <Input
            id="youtubeId"
            {...register('youtubeId', { required: true })}
            placeholder="https://youtu.be/dQw4w9WgXcQ  or  dQw4w9WgXcQ"
            disabled={isLoading}
            className="flex-1 font-mono text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => void handleFetchInfo()}
            disabled={isLoading || isFetchingInfo || !youtubeIdField?.trim()}
            title="Auto-fetch title, channel, and thumbnail from YouTube"
          >
            {isFetchingInfo ? (
              <ArrowsClockwise size={14} className="animate-spin" />
            ) : (
              <ArrowsClockwise size={14} />
            )}
            <span className="ml-1.5">Fetch Info</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Paste a full YouTube URL or a bare 11-character video ID. Click &ldquo;Fetch Info&rdquo; to
          auto-fill the title, channel, and thumbnail.
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="title">Title *</Label>
        <Input id="title" {...register('title', { required: true })} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="artistName">Artist / Channel Name *</Label>
          {artists && artists.length > 0 ? (
            <div className="space-y-1">
              <div className="relative">
                <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden="true" />
                <Input
                  placeholder="Search artist…"
                  value={artistSearch}
                  onChange={(e) => setArtistSearch(e.target.value)}
                  disabled={isLoading}
                  className="pl-8 text-sm"
                  aria-label="Search artists"
                />
              </div>
              <Select
                value={watch('artistName')}
                onValueChange={(val) => {
                  setValue('artistName', val)
                  setArtistSearch('')
                }}
                disabled={isLoading}
              >
                <SelectTrigger id="artistName">
                  <SelectValue placeholder="Select artist…" />
                </SelectTrigger>
                <SelectContent>
                  {artists
                    .filter((a) =>
                      artistSearch === '' ||
                      a.name.toLowerCase().includes(artistSearch.toLowerCase()),
                    )
                    .map((a) => (
                      <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Input id="artistName" {...register('artistName', { required: true })} disabled={isLoading} />
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="publishedAt">Published At</Label>
          <Input id="publishedAt" type="date" {...register('publishedAt')} disabled={isLoading} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="thumbnailUrl">Thumbnail URL</Label>
        <div className="flex gap-2">
          <Input id="thumbnailUrl" {...register('thumbnailUrl')} disabled={isLoading} className="flex-1" />
          <ImageUploadButton
            label="Upload"
            onUploaded={(url) => setValue('thumbnailUrl', url)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id="isVisible"
            checked={isVisible}
            onCheckedChange={(val) => setValue('isVisible', val)}
            disabled={isLoading}
          />
          <Label htmlFor="isVisible">Visible</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="isShort"
            checked={isShort}
            onCheckedChange={(val) => setValue('isShort', val)}
            disabled={isLoading}
          />
          <Label htmlFor="isShort">YouTube Short</Label>
        </div>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        Save Video
      </Button>
    </form>
  )
}
