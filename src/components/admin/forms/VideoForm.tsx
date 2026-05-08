import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { AdminPanelProps } from '@/lib/component-contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface VideoFormData {
  title: string
  artistName: string
  youtubeId: string
  thumbnailUrl: string
  publishedAt: string
}

type Props = AdminPanelProps<VideoFormData>

export function VideoForm({ value, onChange, isLoading }: Props) {
  const { register, handleSubmit, watch, setValue, reset } = useForm<VideoFormData>({
    defaultValues: value,
  })

  useEffect(() => {
    reset(value)
  }, [value, reset])

  const youtubeId = watch('youtubeId')
  const thumbnailUrl = watch('thumbnailUrl')

  useEffect(() => {
    if (youtubeId && !thumbnailUrl) {
      setValue('thumbnailUrl', `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`)
    }
  }, [youtubeId, thumbnailUrl, setValue])

  return (
    <form onSubmit={handleSubmit(onChange)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="title">Title *</Label>
        <Input id="title" {...register('title', { required: true })} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="artistName">Artist Name *</Label>
          <Input id="artistName" {...register('artistName', { required: true })} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="youtubeId">YouTube ID *</Label>
          <Input id="youtubeId" {...register('youtubeId', { required: true })} placeholder="e.g. Bx51eegLTY8" disabled={isLoading} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="thumbnailUrl">Thumbnail URL (auto-filled from YouTube ID)</Label>
        <Input id="thumbnailUrl" {...register('thumbnailUrl')} disabled={isLoading} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="publishedAt">Published At</Label>
        <Input id="publishedAt" type="date" {...register('publishedAt')} disabled={isLoading} />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        Save Video
      </Button>
    </form>
  )
}
