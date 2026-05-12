'use client'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { AdminPanelProps } from '@/lib/component-contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ArrowsClockwise, VinylRecord } from '@phosphor-icons/react'
import { extractSpotifyArtistId } from '@/lib/parsers/platformUrlParser'

/** Maps a Discogs external URL to the appropriate ArtistFormData field key. */
function classifyDiscogsUrl(url: string): keyof ArtistFormData | null {
  try {
    const { hostname, pathname } = new URL(url)
    const h = hostname.toLowerCase().replace(/^www\./, '')
    if (h === 'open.spotify.com' || h === 'spotify.com') {
      if (pathname.includes('/artist/') || pathname.includes('/intl-')) return 'spotifyUrl'
    }
    if (h === 'music.apple.com' || h === 'itunes.apple.com') return 'appleMusicUrl'
    if (h === 'instagram.com') return 'instagramUrl'
    if (h === 'youtube.com' || h === 'youtu.be') return 'youtubeUrl'
    if (h === 'facebook.com') return 'facebookUrl'
    if (h === 'twitter.com' || h === 'x.com') return 'twitterUrl'
    if (h === 'tiktok.com') return 'tiktokUrl'
    if (h.includes('bandcamp.com')) return 'bandcampUrl'
    if (h === 'discogs.com') return null // Skip – it's the source itself
  } catch {
    // ignore invalid URLs
  }
  return null
}

export interface ArtistFormData {
  name: string
  slug: string
  bio: string
  genres: string
  imageUrl: string
  spotifyUrl: string
  appleMusicUrl: string
  instagramUrl: string
  youtubeUrl: string
  websiteUrl: string
  facebookUrl: string
  twitterUrl: string
  tiktokUrl: string
  bandcampUrl: string
  shopUrl: string
  country: string
  foundedYear: string
  email: string
  vatNumber: string
  featured: boolean
  isEuNonGerman: boolean
  isVisible: boolean
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
type PrefillItunesResponse = {
  name: string
  genres: string[]
  imageUrl: string | null
  appleMusicUrl: string
}

export function ArtistForm({ value, onChange, isLoading }: Props) {
  const supabase = createBrowserSupabaseClient()
  const { register, handleSubmit, watch, setValue, reset, getValues } = useForm<ArtistFormData>({
    defaultValues: value,
  })
  const [isFetchingImage, setIsFetchingImage] = useState(false)
  const [isPrefillingSpotify, setIsPrefillingSpotify] = useState(false)
  const [isPrefillingItunes, setIsPrefillingItunes] = useState(false)
  const [isEnrichingDiscogs, setIsEnrichingDiscogs] = useState(false)

  useEffect(() => {
    reset(value)
  }, [value, reset])

  const name = watch('name')
  const slugValue = watch('slug')
  const shopUrl = watch('shopUrl')

  // Track whether the slug was auto-generated so we stop overwriting manual edits
  const lastAutoSlug = useRef(toSlug(name))
  useEffect(() => {
    const auto = toSlug(name)
    if (!slugValue || slugValue === lastAutoSlug.current) {
      setValue('slug', auto)
      lastAutoSlug.current = auto
    }
  }, [name, slugValue, setValue])

  // Track whether the shopUrl was auto-generated so we stop overwriting manual edits
  const lastAutoShopUrl = useRef(slugValue ? `https://darkmerch.com/${slugValue}` : '')
  useEffect(() => {
    const auto = slugValue ? `https://darkmerch.com/${slugValue}` : ''
    if (!shopUrl || shopUrl === lastAutoShopUrl.current) {
      setValue('shopUrl', auto)
      lastAutoShopUrl.current = auto
    }
  }, [slugValue, shopUrl, setValue])

  const featured = watch('featured')
  const isEuNonGerman = watch('isEuNonGerman')
  const isVisible = watch('isVisible')
  const spotifyId = watch('spotifyId')
  const spotifyUrl = watch('spotifyUrl')
  const appleMusicUrl = watch('appleMusicUrl')
  const discogsId = watch('discogsId')

  const handleFetchImage = async () => {
    if (!spotifyId && !discogsId) {
      toast.error('Enter a Spotify ID or Discogs ID first')
      return
    }
    setIsFetchingImage(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/fetch-artist-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ spotifyId: spotifyId || undefined, discogsId: discogsId || undefined }),
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const { imageUrl } = (await res.json()) as { imageUrl: string }
      setValue('imageUrl', imageUrl)
      toast.success('Image fetched successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch image')
    } finally {
      setIsFetchingImage(false)
    }
  }

  const handlePrefillFromSpotify = async () => {
    const spotifyUrlInput = spotifyUrl.trim()
    const spotifyIdInput = spotifyId.trim()
    if (!spotifyUrlInput && !spotifyIdInput) {
      toast.error('Enter a Spotify URL or Spotify ID first')
      return
    }

    setIsPrefillingSpotify(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const source = spotifyUrlInput || `https://open.spotify.com/artist/${spotifyIdInput}`
      const res = await fetch('/api/admin/prefill-artist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ spotifyUrl: source }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      const profile = (await res.json()) as {
        spotifyId: string
        name: string
        imageUrl: string | null
        genres: string[]
        spotifyUrl: string
      }

      const current = getValues()
      if (!(current.name?.trim() ?? '')) setValue('name', profile.name)
      if (!(current.imageUrl?.trim() ?? '') && profile.imageUrl) setValue('imageUrl', profile.imageUrl)
      if (!(current.genres?.trim() ?? '') && profile.genres.length > 0) {
        setValue('genres', profile.genres.join(', '))
      }
      setValue('spotifyId', profile.spotifyId)
      setValue('spotifyUrl', profile.spotifyUrl)

      toast.success('Artist data prefilled from Spotify')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to prefill from Spotify')
    } finally {
      setIsPrefillingSpotify(false)
    }
  }

  const handleEnrichFromDiscogs = async () => {
    const discogsIdInput = discogsId.trim()
    if (!discogsIdInput) {
      toast.error('Enter a Discogs Artist ID first')
      return
    }

    setIsEnrichingDiscogs(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/enrich-artist-discogs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ discogsId: discogsIdInput }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      const profile = (await res.json()) as {
        name: string
        bio: string | null
        imageUrl: string | null
        urls: string[]
      }

      const current = getValues()

      // Only fill empty fields — never overwrite data the admin has entered
      if (!(current.bio?.trim() ?? '') && profile.bio) setValue('bio', profile.bio)
      if (!(current.imageUrl?.trim() ?? '') && profile.imageUrl) setValue('imageUrl', profile.imageUrl)

      // Parse and fill platform URLs from Discogs external links
      let urlsApplied = 0
      for (const urlStr of profile.urls) {
        const field = classifyDiscogsUrl(urlStr)
        if (!field) continue
        const existingVal = current[field]
        if (!(typeof existingVal === 'string' ? existingVal.trim() : '')) {
          // Special case: if Spotify URL, also try to extract spotifyId
          if (field === 'spotifyUrl') {
            const spotifyId = extractSpotifyArtistId(urlStr)
            if (spotifyId && !(current.spotifyId?.trim() ?? '')) {
              setValue('spotifyId', spotifyId)
            }
          }
          setValue(field, urlStr)
          urlsApplied++
        }
      }

      const msg = urlsApplied > 0
        ? `Discogs enrichment applied for "${profile.name}" (${urlsApplied} platform link${urlsApplied > 1 ? 's' : ''} added)`
        : `Discogs enrichment applied for "${profile.name}"`
      toast.success(msg)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to enrich from Discogs')
    } finally {
      setIsEnrichingDiscogs(false)
    }
  }

  const handlePrefillFromItunes = async () => {
    const appleMusicUrlInput = appleMusicUrl.trim()
    if (!appleMusicUrlInput) {
      toast.error('Enter an Apple Music artist URL first')
      return
    }

    setIsPrefillingItunes(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const res = await fetch('/api/admin/prefill-artist-itunes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ appleMusicUrl: appleMusicUrlInput }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      const profile: PrefillItunesResponse = await res.json()

      const current = getValues()
      if (!(current.name?.trim() ?? '')) setValue('name', profile.name)
      if (!(current.imageUrl?.trim() ?? '') && profile.imageUrl) setValue('imageUrl', profile.imageUrl)
      if (!(current.genres?.trim() ?? '') && profile.genres.length > 0) {
        setValue('genres', profile.genres.join(', '))
      }
      setValue('appleMusicUrl', profile.appleMusicUrl)
      toast.success('Artist data prefilled from Apple Music')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to prefill from Apple Music')
    } finally {
      setIsPrefillingItunes(false)
    }
  }

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
          <div className="flex gap-2">
            <Input id="imageUrl" {...register('imageUrl')} disabled={isLoading} className="flex-1" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => void handleFetchImage()}
              disabled={isLoading || isFetchingImage || (!spotifyId && !discogsId)}
              title="Auto-fetch from Spotify or Discogs"
            >
              <ArrowsClockwise size={14} className={isFetchingImage ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="country">Country</Label>
          <Input id="country" {...register('country')} disabled={isLoading} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="foundedYear">Founded Year</Label>
          <Input id="foundedYear" type="number" {...register('foundedYear')} placeholder="e.g. 2012" disabled={isLoading} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="spotifyUrl">Spotify URL</Label>
          <div className="flex gap-2">
            <Input id="spotifyUrl" {...register('spotifyUrl')} disabled={isLoading} className="flex-1" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => void handlePrefillFromSpotify()}
              disabled={isLoading || isPrefillingSpotify || (!spotifyUrl.trim() && !spotifyId.trim())}
            >
              {isPrefillingSpotify && <ArrowsClockwise size={14} className="animate-spin mr-1.5" />}
              Import
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="instagramUrl">Instagram URL</Label>
          <Input id="instagramUrl" {...register('instagramUrl')} disabled={isLoading} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="appleMusicUrl">Apple Music URL</Label>
        <div className="flex gap-2">
          <Input
            id="appleMusicUrl"
            {...register('appleMusicUrl')}
            disabled={isLoading}
            className="flex-1"
            placeholder="https://music.apple.com/..."
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => void handlePrefillFromItunes()}
            disabled={isLoading || isPrefillingItunes || !appleMusicUrl.trim()}
          >
            {isPrefillingItunes && <ArrowsClockwise size={14} className="animate-spin mr-1.5" />}
            Import
          </Button>
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
        <Input id="shopUrl" {...register('shopUrl')} placeholder="Auto-filled from slug" disabled={isLoading} />
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
            <div className="flex gap-2">
              <Input
                id="discogsId"
                {...register('discogsId')}
                placeholder="e.g. 123456"
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void handleEnrichFromDiscogs()}
                disabled={isLoading || isEnrichingDiscogs || !discogsId.trim()}
                title="Enrich bio & image from Discogs"
              >
                {isEnrichingDiscogs ? (
                  <ArrowsClockwise size={14} className="animate-spin" />
                ) : (
                  <VinylRecord size={14} />
                )}
                <span className="ml-1.5">Enrich from Discogs</span>
              </Button>
            </div>
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
            id="isVisible"
            checked={isVisible}
            onCheckedChange={(val) => setValue('isVisible', val)}
            disabled={isLoading}
          />
          <Label htmlFor="isVisible">Visible (public)</Label>
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
