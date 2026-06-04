'use client'

/**
 * app/portal/profile/_components/ProfileForm.tsx — Client Component (leaf)
 *
 * EPK profile editor. Receives all data as props (IoC).
 * Uses react-hook-form + zod for validation.
 * Photo upload goes via the /api/portal/upload-photo Route Handler (not directly
 * to R2) to avoid CORS issues and keep credentials server-side only.
 *
 * Organized into 2 tabs:
 *  1. Bio & Press — photo, bio variants, genres, press quote
 *  2. Links       — website, Instagram, YouTube, Bandcamp
 */

import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Camera, FloppyDisk, Eye, TextAlignLeft, LinkSimple } from '@phosphor-icons/react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { ArtistProfile } from '@/lib/api/artistProfiles'
import type { Dictionary } from '@/i18n/types'
import { EPKPreview } from './EPKPreview'

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const profileSchema = z.object({
  bio: z.string().max(2000, 'Max 2000 characters').optional(),
  bio_short: z.string().max(600, 'Max 600 characters').optional(),
  bio_medium: z.string().max(1800, 'Max 1800 characters').optional(),
  bio_long: z.string().max(6000, 'Max 6000 characters').optional(),
  genres: z.string().optional(),
  website_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  instagram_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  youtube_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  bandcamp_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  press_quote: z.string().max(500, 'Max 500 characters').optional(),
})

type ProfileFormValues = z.infer<typeof profileSchema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProfileFormProps {
  dict: Dictionary['portal']
  artistId: string | null
  artistName: string | null
  artistSlug: string | null
  initialProfile: ArtistProfile | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProfileForm({ dict, artistId, artistName, artistSlug, initialProfile }: ProfileFormProps) {
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(initialProfile?.photoUrl)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const isUploading = uploadProgress !== null && uploadProgress < 100
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      bio: initialProfile?.bio ?? '',
      bio_short: initialProfile?.bioShort ?? '',
      bio_medium: initialProfile?.bioMedium ?? '',
      bio_long: initialProfile?.bioLong ?? '',
      genres: initialProfile?.genres.join(', ') ?? '',
      website_url: initialProfile?.websiteUrl ?? '',
      instagram_url: initialProfile?.instagramUrl ?? '',
      youtube_url: initialProfile?.youtubeUrl ?? '',
      bandcamp_url: initialProfile?.bandcampUrl ?? '',
      press_quote: initialProfile?.pressQuote ?? '',
    },
  })

  if (!artistId) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <p className="text-muted-foreground">{dict.notLinked}</p>
        </CardContent>
      </Card>
    )
  }

  // ---------------------------------------------------------------------------
  // Photo upload — sends to Next.js Route Handler to avoid CORS
  // Uses XHR for real upload progress feedback.
  // ---------------------------------------------------------------------------

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadProgress(0)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error(dict.profile_photoError)
        return
      }

      const body = new FormData()
      body.append('file', file)
      body.append('artistId', artistId)
      const token = session.access_token

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (ev) => {
          if (ev.lengthComputable) {
            setUploadProgress(Math.round((ev.loaded / ev.total) * 100))
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText) as { url?: string }
              if (data.url) {
                setPhotoUrl(data.url)
                setUploadProgress(100)
                resolve()
              } else {
                reject(new Error('No URL in response'))
              }
            } catch {
              reject(new Error('Invalid server response'))
            }
          } else {
            reject(new Error(`Upload failed (${xhr.status})`))
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Network error')))
        xhr.open('POST', '/api/portal/upload-photo')
        xhr.setRequestHeader('Authorization', 'Bearer ' + token)
        xhr.send(body)
      })

      toast.success(dict.profile_photoUploaded)
    } catch {
      toast.error(dict.profile_photoError)
    } finally {
      setTimeout(() => setUploadProgress(null), 800)
    }
  }

  // ---------------------------------------------------------------------------
  // Form submission — upserts via Server Action proxy (API route)
  // ---------------------------------------------------------------------------

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error(dict.profile_error)
        return
      }

      const payload = {
        artist_id: artistId,
        bio: values.bio ?? null,
        bio_short: values.bio_short ?? null,
        bio_medium: values.bio_medium ?? null,
        bio_long: values.bio_long ?? null,
        photo_url: photoUrl ?? null,
        genres: values.genres
          ? values.genres.split(',').map((g) => g.trim()).filter(Boolean)
          : [],
        website_url: values.website_url || null,
        instagram_url: values.instagram_url || null,
        youtube_url: values.youtube_url || null,
        bandcamp_url: values.bandcamp_url || null,
        press_quote: values.press_quote ?? null,
      }

      const res = await fetch('/api/portal/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.access_token,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        toast.error(dict.profile_error)
        return
      }

      toast.success(dict.profile_saved)
    } catch {
      toast.error(dict.profile_error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">{dict.profile_heading}</h1>
          {artistName && (
            <p className="text-muted-foreground text-sm mt-1">
              Artist: <span className="font-medium text-foreground">{artistName}</span>
              {artistSlug && (
                <span className="text-muted-foreground"> · /{artistSlug}</span>
              )}
            </p>
          )}
        </div>
        <div className="no-print flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => window.print()}>
            {dict.profile_download_epk}
          </Button>
          {artistSlug && (
            <Link
              href={`/artists/${artistSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
              aria-label="Preview your public artist profile in a new tab"
            >
              <Eye size={15} aria-hidden="true" />
              {dict.profile_preview_public}
            </Link>
          )}
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs defaultValue="bio" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1 mb-2">
            <TabsTrigger value="bio" className="gap-1.5">
              <TextAlignLeft size={14} aria-hidden="true" />
              {dict.profile_tab_bio}
            </TabsTrigger>
            <TabsTrigger value="links" className="gap-1.5">
              <LinkSimple size={14} aria-hidden="true" />
              {dict.profile_tab_links}
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Bio & Press ──────────────────────────────────────── */}
          <TabsContent value="bio" className="space-y-4 mt-0">
            {/* Photo upload */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{dict.profile_photo}</CardTitle>
                <CardDescription>{dict.profile_photo_description}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-6">
                <Avatar className="w-24 h-24">
                  <AvatarImage src={photoUrl} alt="Profile photo" />
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                    <Camera size={32} />
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2 flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="border-border gap-1.5"
                  >
                    <Camera size={16} aria-hidden="true" />
                    {isUploading ? `${uploadProgress}%` : dict.profile_photo_upload}
                  </Button>
                  {uploadProgress !== null && (
                    <Progress value={uploadProgress} className="h-1 w-48" aria-label="Upload progress" />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Bios */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{dict.profile_biography}</CardTitle>
                <CardDescription>{dict.profile_biography_description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bio">{dict.profile_bio}</Label>
                  <Textarea
                    id="bio"
                    rows={5}
                    className="bg-muted border-border resize-none"
                    {...form.register('bio')}
                  />
                  {form.formState.errors.bio && (
                    <p className="text-sm text-destructive">{form.formState.errors.bio.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio_short">{dict.profile_bio_short}</Label>
                  <Textarea
                    id="bio_short"
                    rows={3}
                    className="bg-muted border-border resize-none"
                    {...form.register('bio_short')}
                  />
                  {form.formState.errors.bio_short && (
                    <p className="text-sm text-destructive">{form.formState.errors.bio_short.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio_medium">{dict.profile_bio_medium}</Label>
                  <Textarea
                    id="bio_medium"
                    rows={6}
                    className="bg-muted border-border resize-none"
                    {...form.register('bio_medium')}
                  />
                  {form.formState.errors.bio_medium && (
                    <p className="text-sm text-destructive">{form.formState.errors.bio_medium.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio_long">{dict.profile_bio_long}</Label>
                  <Textarea
                    id="bio_long"
                    rows={10}
                    className="bg-muted border-border resize-none"
                    {...form.register('bio_long')}
                  />
                  {form.formState.errors.bio_long && (
                    <p className="text-sm text-destructive">{form.formState.errors.bio_long.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Genres & Press Quote */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{dict.profile_genres_press}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="genres">{dict.profile_genres}</Label>
                  <Input
                    id="genres"
                    className="bg-muted border-border"
                    placeholder="Darkpop, EBM, Industrial"
                    {...form.register('genres')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="press_quote">{dict.profile_pressQuote}</Label>
                  <Textarea
                    id="press_quote"
                    rows={2}
                    className="bg-muted border-border resize-none"
                    {...form.register('press_quote')}
                  />
                  {form.formState.errors.press_quote && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.press_quote.message}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab 2: Links ─────────────────────────────────────────────── */}
          <TabsContent value="links" className="space-y-4 mt-0">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{dict.profile_online_presence}</CardTitle>
                <CardDescription>{dict.profile_links_description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(
                    [
                      ['website_url', dict.profile_website],
                      ['instagram_url', dict.profile_instagram],
                      ['youtube_url', dict.profile_youtube],
                      ['bandcamp_url', dict.profile_bandcamp],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field} className="space-y-2">
                      <Label htmlFor={field}>{label}</Label>
                      <Input
                        id={field}
                        type="url"
                        className="bg-muted border-border"
                        placeholder="https://"
                        {...form.register(field)}
                      />
                      {form.formState.errors[field] && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors[field]?.message}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-2 border-t border-border">
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="gap-2 min-w-32"
          >
            <FloppyDisk size={16} aria-hidden="true" />
            {form.formState.isSubmitting ? dict.profile_saving : dict.profile_save}
          </Button>
        </div>
      </form>

      <EPKPreview
        dict={dict}
        artistName={artistName ?? 'Artist'}
        photoUrl={photoUrl}
        bioShort={form.watch('bio_short')}
        bioMedium={form.watch('bio_medium')}
        bioLong={form.watch('bio_long')}
        pressQuote={form.watch('press_quote')}
        genres={form.watch('genres')}
        websiteUrl={form.watch('website_url')}
        instagramUrl={form.watch('instagram_url')}
        youtubeUrl={form.watch('youtube_url')}
        bandcampUrl={form.watch('bandcamp_url')}
      />
    </div>
  )
}
