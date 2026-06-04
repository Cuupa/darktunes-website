'use client'

/**
 * app/portal/profile/_components/ProfileForm.tsx — Client Component (leaf)
 *
 * EPK profile editor. Receives all data as props (IoC).
 * Uses react-hook-form + zod for validation.
 * Photo upload goes via the /api/portal/upload-photo Route Handler.
 * Bio fields use TiptapEditor for rich HTML content.
 *
 * Organised into 4 tabs:
 *  1. Bio & Press  — photo, rich-text bios, genres, press quote
 *  2. Artist Info  — founding year, hometown, booking/press contacts
 *  3. Links        — all social / streaming links
 *  4. EPK Preview  — live preview of the press kit
 */

import { Controller } from 'react-hook-form'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Camera,
  FloppyDisk,
  Eye,
  TextAlignLeft,
  LinkSimple,
  Info,
  Newspaper,
} from '@phosphor-icons/react'
import { TiptapEditor } from '@/components/admin/TiptapEditor'
import type { ArtistProfile } from '@/lib/api/artistProfiles'
import type { Dictionary } from '@/i18n/types'
import { EPKPreview } from './EPKPreview'
import type { EPKData } from './EPKPreview'
import { usePortalProfileForm } from '@/hooks/usePortalProfileForm'

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
  if (!artistId) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <p className="text-muted-foreground">{dict.notLinked}</p>
        </CardContent>
      </Card>
    )
  }

  return <ProfileFormInner dict={dict} artistId={artistId} artistName={artistName} artistSlug={artistSlug} initialProfile={initialProfile} />
}

interface ProfileFormInnerProps extends Omit<ProfileFormProps, 'artistId'> {
  artistId: string
}

function ProfileFormInner({ dict, artistId, artistName, artistSlug, initialProfile }: ProfileFormInnerProps) {
  const {
    form,
    photoUrl,
    uploadProgress,
    isUploading,
    fileInputRef,
    watched,
    handlePhotoChange,
    onSubmit,
  } = usePortalProfileForm({ artistId, initialProfile, dict })

  // ---------------------------------------------------------------------------
  // Build live EPK data from form watch
  // ---------------------------------------------------------------------------

  const epkData: EPKData = {
    artistName: artistName ?? 'Artist',
    photoUrl,
    bioShort: watched.bio_short,
    bioMedium: watched.bio_medium,
    bioLong: watched.bio_long,
    pressQuote: watched.press_quote,
    genres: watched.genres,
    foundingYear: watched.founding_year ? parseInt(watched.founding_year, 10) : undefined,
    hometown: watched.hometown,
    bookingContact: watched.booking_contact,
    pressContact: watched.press_contact,
    websiteUrl: watched.website_url,
    instagramUrl: watched.instagram_url,
    youtubeUrl: watched.youtube_url,
    bandcampUrl: watched.bandcamp_url,
    spotifyUrl: watched.spotify_url,
    appleMusicUrl: watched.apple_music_url,
    tiktokUrl: watched.tiktok_url,
    facebookUrl: watched.facebook_url,
    soundcloudUrl: watched.soundcloud_url,
  }

  // ---------------------------------------------------------------------------
  // URL fields config
  // ---------------------------------------------------------------------------

  const linkFields = [
    { field: 'website_url',     label: dict.profile_website      },
    { field: 'spotify_url',     label: dict.profile_spotify      },
    { field: 'apple_music_url', label: dict.profile_apple_music  },
    { field: 'instagram_url',   label: dict.profile_instagram    },
    { field: 'youtube_url',     label: dict.profile_youtube      },
    { field: 'tiktok_url',      label: dict.profile_tiktok       },
    { field: 'facebook_url',    label: dict.profile_facebook     },
    { field: 'soundcloud_url',  label: dict.profile_soundcloud   },
    { field: 'bandcamp_url',    label: dict.profile_bandcamp     },
  ] as const

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

      <form onSubmit={onSubmit} className="space-y-6">
        <Tabs defaultValue="bio" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1 mb-2">
            <TabsTrigger value="bio" className="gap-1.5">
              <TextAlignLeft size={14} aria-hidden="true" />
              {dict.profile_tab_bio}
            </TabsTrigger>
            <TabsTrigger value="info" className="gap-1.5">
              <Info size={14} aria-hidden="true" />
              {dict.profile_tab_info}
            </TabsTrigger>
            <TabsTrigger value="links" className="gap-1.5">
              <LinkSimple size={14} aria-hidden="true" />
              {dict.profile_tab_links}
            </TabsTrigger>
            <TabsTrigger value="epk" className="gap-1.5">
              <Newspaper size={14} aria-hidden="true" />
              {dict.profile_tab_epk}
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

            {/* Bios using TiptapEditor */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{dict.profile_biography}</CardTitle>
                <CardDescription>{dict.profile_biography_description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>{dict.profile_bio_short}</Label>
                  <p className="text-xs text-muted-foreground">{dict.profile_bio_short_desc}</p>
                  <Controller
                    control={form.control}
                    name="bio_short"
                    render={({ field }) => (
                      <TiptapEditor
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        placeholder={dict.profile_bio_short}
                      />
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{dict.profile_bio_medium}</Label>
                  <p className="text-xs text-muted-foreground">{dict.profile_bio_medium_desc}</p>
                  <Controller
                    control={form.control}
                    name="bio_medium"
                    render={({ field }) => (
                      <TiptapEditor
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        placeholder={dict.profile_bio_medium}
                      />
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{dict.profile_bio_long}</Label>
                  <p className="text-xs text-muted-foreground">{dict.profile_bio_long_desc}</p>
                  <Controller
                    control={form.control}
                    name="bio_long"
                    render={({ field }) => (
                      <TiptapEditor
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        placeholder={dict.profile_bio_long}
                      />
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab 2: Artist Info ────────────────────────────────────────── */}
          <TabsContent value="info" className="space-y-4 mt-0">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{dict.profile_info_heading}</CardTitle>
                <CardDescription>{dict.profile_info_description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="founding_year">{dict.profile_founding_year}</Label>
                    <Input
                      id="founding_year"
                      type="number"
                      min={1900}
                      max={2100}
                      className="bg-muted border-border"
                      placeholder="e.g. 2015"
                      {...form.register('founding_year')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hometown">{dict.profile_hometown}</Label>
                    <Input
                      id="hometown"
                      className="bg-muted border-border"
                      placeholder="e.g. Berlin, Germany"
                      {...form.register('hometown')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="booking_contact">{dict.profile_booking_contact}</Label>
                  <Input
                    id="booking_contact"
                    className="bg-muted border-border"
                    placeholder={dict.profile_contact_placeholder}
                    {...form.register('booking_contact')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="press_contact">{dict.profile_press_contact}</Label>
                  <Input
                    id="press_contact"
                    className="bg-muted border-border"
                    placeholder={dict.profile_contact_placeholder}
                    {...form.register('press_contact')}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Tab 3: Links ─────────────────────────────────────────────── */}
          <TabsContent value="links" className="space-y-4 mt-0">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{dict.profile_online_presence}</CardTitle>
                <CardDescription>{dict.profile_links_description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {linkFields.map(({ field, label }) => (
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

          {/* ── Tab 4: EPK Preview ───────────────────────────────────────── */}
          <TabsContent value="epk" className="mt-0">
            <EPKPreview
              dict={dict}
              data={epkData}
              artistSlug={artistSlug}
            />
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
    </div>
  )
}

