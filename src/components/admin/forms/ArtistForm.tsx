'use client'
import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { AdminPanelProps } from '@/lib/component-contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowsClockwise,
  VinylRecord,
  User,
  LinkSimple,
  InstagramLogo,
  Briefcase,
  Database,
  FloppyDisk,
  Image,
} from '@phosphor-icons/react'
import { extractSpotifyArtistId } from '@/lib/parsers/platformUrlParser'
import { AssetPicker } from '../file-explorer/AssetPicker'
import { ImageUploadButton } from './ImageUploadButton'
import { TiptapEditor } from '@/components/admin/TiptapEditor'

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
  /** Optional logo/wordmark URL for the artists grid hover effect. */
  logoUrl: string
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

/**
 * Mode controls which tabs and fields are exposed.
 * - 'admin'  → all 5 tabs (Identity, Streaming, Social, Business, Sync-IDs); all fields editable
 * - 'artist' → 3 tabs (Identity, Streaming, Social);
 *              name + slug are read-only; Business / Sync-IDs tabs hidden
 */
export type ArtistFormMode = 'admin' | 'artist'

function toSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritical marks
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Thin indeterminate bar shown during async API calls. */
function IndeterminateBar() {
  return (
    <div className="h-1 w-full bg-primary/20 rounded-full overflow-hidden mt-1" role="progressbar" aria-label="Loading">
      <div className="h-full bg-primary rounded-full animate-[progress-indeterminate_1.4s_ease-in-out_infinite]" />
    </div>
  )
}

type Props = AdminPanelProps<ArtistFormData> & {
  mode?: ArtistFormMode
  artistId?: string
}
type PrefillItunesResponse = {
  name: string
  genres: string[]
  imageUrl: string | null
  appleMusicUrl: string
}

export function ArtistForm({ value, onChange, isLoading, mode = 'admin', artistId }: Props) {
  const supabase = createBrowserSupabaseClient()
  const { register, handleSubmit, watch, setValue, reset, getValues, control } = useForm<ArtistFormData>({
    defaultValues: value,
  })
  const [isFetchingImage, setIsFetchingImage] = useState(false)
  const [isPrefillingSpotify, setIsPrefillingSpotify] = useState(false)
  const [isPrefillingItunes, setIsPrefillingItunes] = useState(false)
  const [isEnrichingDiscogs, setIsEnrichingDiscogs] = useState(false)
  const [assetPickerTarget, setAssetPickerTarget] = useState<'imageUrl' | 'logoUrl' | null>(null)

  const isAnyAsyncRunning = isFetchingImage || isPrefillingSpotify || isPrefillingItunes || isEnrichingDiscogs

  useEffect(() => {
    reset(value)
  }, [value, reset])

  const name = watch('name')
  const slugValue = watch('slug')
  const shopUrl = watch('shopUrl')

  // Auto-generate slug from name while user hasn't manually changed it
  const lastAutoSlug = useRef(toSlug(name))
  useEffect(() => {
    if (mode === 'artist') return
    const auto = toSlug(name)
    if (!slugValue || slugValue === lastAutoSlug.current) {
      setValue('slug', auto)
      lastAutoSlug.current = auto
    }
  }, [name, slugValue, setValue, mode])

  // Auto-generate shop URL from slug
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
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')
      const source = spotifyUrlInput || `https://open.spotify.com/artist/${spotifyIdInput}`
      const res = await fetch('/api/admin/prefill-artist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ spotifyUrl: source }),
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const profile = (await res.json()) as {
        spotifyId: string; name: string; imageUrl: string | null; genres: string[]; spotifyUrl: string
      }
      const current = getValues()
      if (!(current.name?.trim() ?? '')) setValue('name', profile.name)
      if (!(current.imageUrl?.trim() ?? '') && profile.imageUrl) setValue('imageUrl', profile.imageUrl)
      if (!(current.genres?.trim() ?? '') && profile.genres.length > 0) setValue('genres', profile.genres.join(', '))
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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')
      const res = await fetch('/api/admin/enrich-artist-discogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ discogsId: discogsIdInput }),
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const profile = (await res.json()) as { name: string; bio: string | null; imageUrl: string | null; urls: string[] }
      const current = getValues()
      if (!(current.bio?.trim() ?? '') && profile.bio) setValue('bio', profile.bio)
      if (!(current.imageUrl?.trim() ?? '') && profile.imageUrl) setValue('imageUrl', profile.imageUrl)
      let urlsApplied = 0
      for (const urlStr of profile.urls) {
        const field = classifyDiscogsUrl(urlStr)
        if (!field) continue
        const existingVal = current[field]
        if (!(typeof existingVal === 'string' ? existingVal.trim() : '')) {
          if (field === 'spotifyUrl') {
            const id = extractSpotifyArtistId(urlStr)
            if (id && !(current.spotifyId?.trim() ?? '')) setValue('spotifyId', id)
          }
          setValue(field, urlStr)
          urlsApplied++
        }
      }
      const msg = urlsApplied > 0
        ? `Discogs enrichment applied for "${profile.name}" (${urlsApplied} link${urlsApplied > 1 ? 's' : ''} added)`
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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')
      const res = await fetch('/api/admin/prefill-artist-itunes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
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
      if (!(current.genres?.trim() ?? '') && profile.genres.length > 0) setValue('genres', profile.genres.join(', '))
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
      {/* Global async indicator – thin bar at top of form */}
      <div className="h-1 w-full">
        {isAnyAsyncRunning && <IndeterminateBar />}
      </div>

      <Tabs defaultValue="identity" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 mb-2">
          <TabsTrigger value="identity" className="gap-1.5">
            <User size={14} aria-hidden="true" />
            Identity
          </TabsTrigger>
          <TabsTrigger value="streaming" className="gap-1.5">
            <LinkSimple size={14} aria-hidden="true" />
            Streaming &amp; Links
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-1.5">
            <InstagramLogo size={14} aria-hidden="true" />
            Social Media
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-1.5">
            <Image size={14} aria-hidden="true" />
            Assets
          </TabsTrigger>
          {mode === 'admin' && (
            <TabsTrigger value="business" className="gap-1.5">
              <Briefcase size={14} aria-hidden="true" />
              Business
            </TabsTrigger>
          )}
          {mode === 'admin' && (
            <TabsTrigger value="sync" className="gap-1.5">
              <Database size={14} aria-hidden="true" />
              Sync-IDs
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Tab 1: Identity ─────────────────────────────────────────── */}
        <TabsContent value="identity" className="space-y-4 mt-0">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="name">Name *</Label>
              {mode === 'artist' ? (
                <>
                  <Input
                    id="name"
                    value={name}
                    disabled
                    readOnly
                    className="bg-muted text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">Band name can only be changed by an admin.</p>
                </>
              ) : (
                <Input id="name" {...register('name', { required: true })} disabled={isLoading} />
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                {...register('slug', { required: true })}
                disabled={isLoading || mode === 'artist'}
                readOnly={mode === 'artist'}
                className={mode === 'artist' ? 'bg-muted text-muted-foreground' : ''}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="bio">Bio</Label>
            <Controller
              name="bio"
              control={control}
              render={({ field }) => (
                <TiptapEditor
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  disabled={isLoading}
                  placeholder="Describe this artist…"
                />
              )}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="genres">
              Genres{' '}
              <span className="text-muted-foreground text-xs font-normal">(comma-separated)</span>
            </Label>
            <Input id="genres" {...register('genres')} placeholder="e.g. Industrial, EBM, Darkwave" disabled={isLoading} />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
              <Label htmlFor="imageUrl">Image URL</Label>
              <div className="flex gap-2 items-start">
                <Input id="imageUrl" {...register('imageUrl')} disabled={isLoading} className="flex-1" />
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setAssetPickerTarget('imageUrl')}>
                  Open Asset Picker
                </Button>
                <ImageUploadButton label="Upload" onUploaded={(url) => setValue('imageUrl', url)} />
                {mode === 'admin' && (
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
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="logoUrl">
                Logo / Wordmark URL{' '}
                <span className="text-muted-foreground text-xs font-normal">(hover effect)</span>
              </Label>
              <div className="flex gap-2 items-start">
                <Input id="logoUrl" {...register('logoUrl')} disabled={isLoading} className="flex-1" />
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setAssetPickerTarget('logoUrl')}>
                  Open Asset Picker
                </Button>
                <ImageUploadButton label="Upload" onUploaded={(url) => setValue('logoUrl', url)} />
              </div>
            </div>
          </div>

          {mode === 'admin' && (
            <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-border">
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
          )}
        </TabsContent>

        {/* ── Tab 2: Streaming & Links ─────────────────────────────────── */}
        <TabsContent value="streaming" className="space-y-4 mt-0">
          <div className="space-y-1">
            <Label htmlFor="spotifyUrl">Spotify URL</Label>
            <div className="flex gap-2 items-start">
              <Input
                id="spotifyUrl"
                {...register('spotifyUrl')}
                disabled={isLoading}
                className="flex-1"
                placeholder="https://open.spotify.com/artist/…"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => void handlePrefillFromSpotify()}
                disabled={isLoading || isPrefillingSpotify || (!spotifyUrl.trim() && !spotifyId.trim())}
                title="Import artist data from Spotify"
              >
                <ArrowsClockwise size={14} className={isPrefillingSpotify ? 'animate-spin' : ''} />
                Import
              </Button>
            </div>
            {isPrefillingSpotify && <IndeterminateBar />}
          </div>

          <div className="space-y-1">
            <Label htmlFor="appleMusicUrl">Apple Music URL</Label>
            <div className="flex gap-2 items-start">
              <Input
                id="appleMusicUrl"
                {...register('appleMusicUrl')}
                disabled={isLoading}
                className="flex-1"
                placeholder="https://music.apple.com/…"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => void handlePrefillFromItunes()}
                disabled={isLoading || isPrefillingItunes || !appleMusicUrl.trim()}
                title="Import artist data from Apple Music"
              >
                <ArrowsClockwise size={14} className={isPrefillingItunes ? 'animate-spin' : ''} />
                Import
              </Button>
            </div>
            {isPrefillingItunes && <IndeterminateBar />}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="youtubeUrl">YouTube URL</Label>
              <Input id="youtubeUrl" {...register('youtubeUrl')} disabled={isLoading} placeholder="https://youtube.com/…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bandcampUrl">Bandcamp URL</Label>
              <Input id="bandcampUrl" {...register('bandcampUrl')} disabled={isLoading} placeholder="https://…bandcamp.com" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input id="websiteUrl" {...register('websiteUrl')} disabled={isLoading} placeholder="https://…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="shopUrl">
                Shop URL{' '}
                <span className="text-muted-foreground text-xs font-normal">(Darkmerch)</span>
              </Label>
              <Input id="shopUrl" {...register('shopUrl')} placeholder="Auto-filled from slug" disabled={isLoading} />
            </div>
          </div>
        </TabsContent>

        {/* ── Tab 3: Social Media ───────────────────────────────────────── */}
        <TabsContent value="social" className="space-y-4 mt-0">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="instagramUrl">Instagram</Label>
              <Input id="instagramUrl" {...register('instagramUrl')} disabled={isLoading} placeholder="https://instagram.com/…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="facebookUrl">Facebook</Label>
              <Input id="facebookUrl" {...register('facebookUrl')} disabled={isLoading} placeholder="https://facebook.com/…" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="twitterUrl">X / Twitter</Label>
              <Input id="twitterUrl" {...register('twitterUrl')} disabled={isLoading} placeholder="https://x.com/…" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tiktokUrl">TikTok</Label>
              <Input id="tiktokUrl" {...register('tiktokUrl')} disabled={isLoading} placeholder="https://tiktok.com/@…" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="assets" className="space-y-4 mt-0">
          <div className="rounded-lg border border-border bg-card/40 p-4 space-y-3">
            <h3 className="text-sm font-semibold">Asset Library</h3>
            <p className="text-sm text-muted-foreground">
              Pick existing files from the asset manager for the artist photo or logo. The picker is filtered to the current artist when available.
            </p>
            {!artistId ? (
              <p className="text-xs text-muted-foreground">
                Save the artist first to filter assets by ownership. You can still use the field-level asset picker above.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setAssetPickerTarget('imageUrl')}>
                  Pick Artist Image
                </Button>
                <Button type="button" variant="outline" onClick={() => setAssetPickerTarget('logoUrl')}>
                  Pick Logo / Wordmark
                </Button>
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current image</p>
                <p className="mt-2 break-all text-sm">{watch('imageUrl') || 'No image selected yet.'}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current logo</p>
                <p className="mt-2 break-all text-sm">{watch('logoUrl') || 'No logo selected yet.'}</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Tab 4: Business (admin only) ─────────────────────────────── */}
        {mode === 'admin' && (
          <TabsContent value="business" className="space-y-4 mt-0">
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
              <Label htmlFor="notes">Internal Notes</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                rows={3}
                disabled={isLoading}
                placeholder="Internal notes — not visible to the artist."
              />
            </div>
          </TabsContent>
        )}

        {/* ── Tab 5: Sync-IDs (admin only) ─────────────────────────────── */}
        {mode === 'admin' && (
          <TabsContent value="sync" className="space-y-4 mt-0">
            <p className="text-sm text-muted-foreground">
              Platform IDs used for automatic release synchronisation. All fields are optional.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="spotifyId">Spotify Artist ID</Label>
                <Input
                  id="spotifyId"
                  {...register('spotifyId')}
                  placeholder="e.g. 1Cs0zKBU1kc0i8ypK3B9ai"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="discogsId">Discogs Artist ID</Label>
                <div className="flex gap-2 items-start">
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
                    className="shrink-0 gap-1.5"
                    onClick={() => void handleEnrichFromDiscogs()}
                    disabled={isLoading || isEnrichingDiscogs || !discogsId.trim()}
                    title="Enrich bio & image from Discogs"
                  >
                    {isEnrichingDiscogs ? (
                      <ArrowsClockwise size={14} className="animate-spin" />
                    ) : (
                      <VinylRecord size={14} />
                    )}
                    Enrich
                  </Button>
                </div>
                {isEnrichingDiscogs && <IndeterminateBar />}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="songkickId">Songkick Artist ID</Label>
                <Input
                  id="songkickId"
                  {...register('songkickId')}
                  placeholder="e.g. 789012"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bandsintownId">Bandsintown Artist ID</Label>
                <Input
                  id="bandsintownId"
                  {...register('bandsintownId')}
                  placeholder="e.g. Artist Name or id:12345"
                  disabled={isLoading}
                />
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <AssetPicker
        open={assetPickerTarget !== null}
        onClose={() => setAssetPickerTarget(null)}
        mimeTypeFilter="image/"
        artistId={artistId}
        onSelect={(asset) => {
          if (!assetPickerTarget) return
          setValue(assetPickerTarget, asset.publicUrl)
          toast.success('Asset selected')
        }}
      />

      <div className="flex justify-end pt-2 border-t border-border">
        <Button type="submit" disabled={isLoading} className="gap-2 min-w-32">
          <FloppyDisk size={16} aria-hidden="true" />
          {isLoading ? 'Saving…' : 'Save Artist'}
        </Button>
      </div>
    </form>
  )
}
