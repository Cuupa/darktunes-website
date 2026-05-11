'use client'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import type { AdminPanelProps } from '@/lib/component-contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export interface ArtistFormData {
  name: string
  slug: string
  bio: string
  genres: string
  imageUrl: string
  spotifyUrl: string
  instagramUrl: string
  youtubeUrl: string
  websiteUrl: string
  facebookUrl: string
  twitterUrl: string
  tiktokUrl: string
  bandcampUrl: string
  shopUrl: string
  country: string
  email: string
  vatNumber: string
  featured: boolean
  isEuNonGerman: boolean
  notes: string
  spotifyId: string
  discogsId: string
  songkickId: string
  bandsintownId: string
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

type Props = AdminPanelProps<ArtistFormData>

export function ArtistForm({ value, onChange, isLoading }: Props) {
  const { register, handleSubmit, watch, setValue, reset } = useForm<ArtistFormData>({
    defaultValues: value,
  })

  useEffect(() => {
    reset(value)
  }, [value, reset])

  const name = watch('name')
  const slugValue = watch('slug')

  // Track whether the slug was auto-generated so we stop overwriting manual edits
  const lastAutoSlug = useRef(toSlug(name))
  useEffect(() => {
    const auto = toSlug(name)
    if (!slugValue || slugValue === lastAutoSlug.current) {
      setValue('slug', auto)
      lastAutoSlug.current = auto
    }
  }, [name, slugValue, setValue])

  const featured = watch('featured')
  const isEuNonGerman = watch('isEuNonGerman')

  return (
    <form onSubmit={handleSubmit(onChange)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="name">Name *</Label>
          <Input id="name" {...register('name', { required: true })} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="slug">Slug *</Label>
          <Input id="slug" {...register('slug', { required: true })} disabled={isLoading} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" {...register('bio')} rows={3} disabled={isLoading} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="genres">Genres (comma-separated)</Label>
        <Input id="genres" {...register('genres')} placeholder="e.g. Industrial, EBM, Darkwave" disabled={isLoading} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="imageUrl">Image URL</Label>
          <Input id="imageUrl" {...register('imageUrl')} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="country">Country</Label>
          <Input id="country" {...register('country')} disabled={isLoading} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="spotifyUrl">Spotify URL</Label>
          <Input id="spotifyUrl" {...register('spotifyUrl')} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="instagramUrl">Instagram URL</Label>
          <Input id="instagramUrl" {...register('instagramUrl')} disabled={isLoading} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="youtubeUrl">YouTube URL</Label>
          <Input id="youtubeUrl" {...register('youtubeUrl')} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="websiteUrl">Website URL</Label>
          <Input id="websiteUrl" {...register('websiteUrl')} disabled={isLoading} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="facebookUrl">Facebook URL</Label>
          <Input id="facebookUrl" {...register('facebookUrl')} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="twitterUrl">X / Twitter URL</Label>
          <Input id="twitterUrl" {...register('twitterUrl')} disabled={isLoading} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="tiktokUrl">TikTok URL</Label>
          <Input id="tiktokUrl" {...register('tiktokUrl')} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="bandcampUrl">Bandcamp URL</Label>
          <Input id="bandcampUrl" {...register('bandcampUrl')} disabled={isLoading} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="shopUrl">Shop URL (Darkmerch)</Label>
        <Input id="shopUrl" {...register('shopUrl')} placeholder="https://darkmerch.com/..." disabled={isLoading} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register('email')} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="vatNumber">VAT Number</Label>
          <Input id="vatNumber" {...register('vatNumber')} disabled={isLoading} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" {...register('notes')} rows={2} disabled={isLoading} />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Auto-Sync IDs
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="spotifyId">Spotify Artist ID (optional)</Label>
            <Input
              id="spotifyId"
              {...register('spotifyId')}
              placeholder="e.g. 1Cs0zKBU1kc0i8ypK3B9ai"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="discogsId">Discogs Artist ID (optional)</Label>
            <Input
              id="discogsId"
              {...register('discogsId')}
              placeholder="e.g. 123456"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="songkickId">Songkick Artist ID (optional)</Label>
            <Input
              id="songkickId"
              {...register('songkickId')}
              placeholder="e.g. 789012"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bandsintownId">Bandsintown Artist ID (optional)</Label>
            <Input
              id="bandsintownId"
              {...register('bandsintownId')}
              placeholder="e.g. Artist Name or id:12345"
              disabled={isLoading}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          These IDs are used for automatic release sync. All fields are optional.
        </p>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            id="featured"
            checked={featured}
            onCheckedChange={(val) => setValue('featured', val)}
            disabled={isLoading}
          />
          <Label htmlFor="featured">Featured</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="isEuNonGerman"
            checked={isEuNonGerman}
            onCheckedChange={(val) => setValue('isEuNonGerman', val)}
            disabled={isLoading}
          />
          <Label htmlFor="isEuNonGerman">EU Non-German</Label>
        </div>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        Save Artist
      </Button>
    </form>
  )
}
