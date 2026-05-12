'use client'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { AdminPanelProps } from '@/lib/component-contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowsClockwise } from '@phosphor-icons/react'

export interface VideoFormData {
  title: string
  artistName: string
  youtubeId: string
  thumbnailUrl: string
  publishedAt: string
}

type Props = AdminPanelProps<VideoFormData>

/** Extracts a YouTube video ID from a URL or returns null if unrecognised. */
function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    if (
      (parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com') &&
      parsed.pathname === '/watch'
    ) {
      const v = parsed.searchParams.get('v')
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v
    }
    if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.slice(1).split('/')[0]
      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return id
    }
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (['embed', 'v', 'shorts'].includes(parts[0]) && parts[1]) {
      const id = parts[1].split('?')[0]
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id
    }
  } catch {
    return null
  }
  return null
}

export function VideoForm({ value, onChange, isLoading }: Props) {
  const supabase = createBrowserSupabaseClient()
  const { register, handleSubmit, watch, setValue, reset } = useForm<VideoFormData>({
    defaultValues: value,
  })
  const [isFetchingInfo, setIsFetchingInfo] = useState(false)

  useEffect(() => {
    reset(value)
  }, [value, reset])

  const youtubeIdField = watch('youtubeId')
  const thumbnailUrl = watch('thumbnailUrl')

  // Auto-extract YouTube ID when the user pastes a full URL
  const lastParsed = useRef('')
  useEffect(() => {
    const raw = youtubeIdField ?? ''
    if (raw === lastParsed.current) return
    // Only attempt extraction if the value looks like a URL (contains '/')
    if (raw.includes('/')) {
      const extracted = extractYouTubeId(raw)
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
          <Input id="artistName" {...register('artistName', { required: true })} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="publishedAt">Published At</Label>
          <Input id="publishedAt" type="date" {...register('publishedAt')} disabled={isLoading} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="thumbnailUrl">Thumbnail URL (auto-filled)</Label>
        <Input id="thumbnailUrl" {...register('thumbnailUrl')} disabled={isLoading} />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        Save Video
      </Button>
    </form>
  )
}
