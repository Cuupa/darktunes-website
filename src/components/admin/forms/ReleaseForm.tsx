'use client'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { AdminPanelProps } from '@/lib/component-contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface ReleaseFormData {
  title: string
  artistName: string
  releaseDate: string
  type: 'album' | 'ep' | 'single'
  coverArt: string
  spotifyUrl: string
  appleMusicUrl: string
  youtubeUrl: string
  featured: boolean
}

type Props = AdminPanelProps<ReleaseFormData>

export function ReleaseForm({ value, onChange, isLoading }: Props) {
  const { register, handleSubmit, watch, setValue, reset } = useForm<ReleaseFormData>({
    defaultValues: value,
  })

  useEffect(() => {
    reset(value)
  }, [value, reset])

  const featured = watch('featured')
  const type = watch('type')

  return (
    <form onSubmit={handleSubmit(onChange)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="title">Title *</Label>
          <Input id="title" {...register('title', { required: true })} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="artistName">Artist Name *</Label>
          <Input id="artistName" {...register('artistName', { required: true })} disabled={isLoading} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="releaseDate">Release Date *</Label>
          <Input id="releaseDate" type="date" {...register('releaseDate', { required: true })} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="type">Type *</Label>
          <Select
            value={type}
            onValueChange={(val) => setValue('type', val as 'album' | 'ep' | 'single')}
            disabled={isLoading}
          >
            <SelectTrigger id="type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="album">Album</SelectItem>
              <SelectItem value="ep">EP</SelectItem>
              <SelectItem value="single">Single</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="coverArt">Cover Art URL</Label>
        <Input id="coverArt" {...register('coverArt')} disabled={isLoading} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="spotifyUrl">Spotify URL</Label>
          <Input id="spotifyUrl" {...register('spotifyUrl')} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="appleMusicUrl">Apple Music URL</Label>
          <Input id="appleMusicUrl" {...register('appleMusicUrl')} disabled={isLoading} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="youtubeUrl">YouTube URL</Label>
        <Input id="youtubeUrl" {...register('youtubeUrl')} disabled={isLoading} />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="featured"
          checked={featured}
          onCheckedChange={(val) => setValue('featured', val)}
          disabled={isLoading}
        />
        <Label htmlFor="featured">Featured</Label>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        Save Release
      </Button>
    </form>
  )
}
