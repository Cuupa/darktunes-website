'use client'

/**
 * app/portal/profile/_components/ProfileForm.tsx — Client Component (leaf)
 *
 * EPK profile editor. Receives all data as props (IoC).
 * Uses react-hook-form + zod for validation.
 * Photo upload goes via the /api/portal/upload-photo Route Handler (not directly
 * to R2) to avoid CORS issues and keep credentials server-side only.
 */

import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Camera, FloppyDisk } from '@phosphor-icons/react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { ArtistProfile } from '@/lib/api/artistProfiles'
import type { Dictionary } from '@/i18n/types'

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
  initialProfile: ArtistProfile | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProfileForm({ dict, artistId, initialProfile }: ProfileFormProps) {
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(initialProfile?.photoUrl)
  const [isUploading, setIsUploading] = useState(false)
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
  // ---------------------------------------------------------------------------

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        toast.error(dict.profile_photoError)
        return
      }

      const body = new FormData()
      body.append('file', file)
      body.append('artistId', artistId)

      const res = await fetch('/api/portal/upload-photo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
      })

      if (!res.ok) {
        toast.error(dict.profile_photoError)
        return
      }

      const { url } = (await res.json()) as { url: string }
      setPhotoUrl(url)
      toast.success(dict.profile_photoUploaded)
    } catch {
      toast.error(dict.profile_photoError)
    } finally {
      setIsUploading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Form submission — upserts via Server Action proxy (API route)
  // ---------------------------------------------------------------------------

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

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
          Authorization: `Bearer ${session.access_token}`,
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
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{dict.profile_heading}</h1>

      {/* Photo upload */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">{dict.profile_photo}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <Avatar className="w-24 h-24">
            <AvatarImage src={photoUrl} alt="Profile photo" />
            <AvatarFallback className="bg-primary/10 text-primary text-2xl">
              <Camera size={32} />
            </AvatarFallback>
          </Avatar>
          <div>
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
              className="border-border"
            >
              <Camera size={16} className="mr-2" />
              {isUploading ? '…' : dict.profile_photo_upload}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Profile fields */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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

            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full md:w-auto"
            >
              <FloppyDisk size={16} className="mr-2" />
              {form.formState.isSubmitting ? dict.profile_saving : dict.profile_save}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
