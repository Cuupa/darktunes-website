/**
 * src/hooks/usePortalProfileForm.ts
 *
 * Encapsulates form state, photo-upload XHR, and profile-save networking
 * for the Artist Portal profile page.  Keeps the UI component (ProfileForm)
 * free of business / data logic (SRP).
 */

'use client'

import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import {
  PortalProfileSaveError,
  uploadArtistPhoto,
  uploadRiderDocument,
  saveArtistProfile,
} from '@/lib/api/portalProfile'
import { getErrorMessage } from '@/lib/clientErrors'
import type { RiderType } from '@/lib/api/portalProfile'
import type { ArtistProfile } from '@/lib/api/artistProfiles'
import type { Artist } from '@/types'
import { compressImage } from '@/lib/imageResizer'

/** Portal photo upload hard limit at /api/portal/upload-photo (5 MB). */
export const PORTAL_PHOTO_MAX_BYTES = 5 * 1024 * 1024

// ---------------------------------------------------------------------------
// Zod schema (shared with ProfileForm so both stay in sync)
// ---------------------------------------------------------------------------

const optionalUrl = z.string().url('Must be a valid URL').optional().or(z.literal(''))

export const profileSchema = z.object({
  // Not edited in the portal UI — only re-sent to preserve artists.bio.
  // Label CMS bios can be long HTML; keep in sync with the API max.
  bio: z.string().max(50000).optional(),
  bio_short: z.string().max(6000).optional(),
  bio_medium: z.string().max(12000).optional(),
  bio_long: z.string().max(30000).optional(),
  genres: z.string().optional(),
  press_quote: z.string().max(1000).optional(),
  founding_year: z.string().optional(),
  hometown: z.string().max(200).optional(),
  booking_contact: z.string().max(500).optional(),
  press_contact: z.string().max(500).optional(),
  website_url: optionalUrl,
  instagram_url: optionalUrl,
  youtube_url: optionalUrl,
  bandcamp_url: optionalUrl,
  spotify_url: optionalUrl,
  apple_music_url: optionalUrl,
  tiktok_url: optionalUrl,
  facebook_url: optionalUrl,
  soundcloud_url: optionalUrl,
  custom_links: z.array(z.object({
    label: z.string().min(1, 'Label required'),
    url: z.string().url('Must be a valid URL').or(z.literal('')),
  })).optional(),
})

export type ProfileFormValues = z.infer<typeof profileSchema>

/** Use profile value when non-empty; otherwise fall back to the label artist record. */
function coalesceNonEmpty(profileValue: string | undefined, fallback: string | undefined): string {
  if (profileValue?.trim()) return profileValue
  return fallback?.trim() ?? ''
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UsePortalProfileFormOptions {
  artistId: string
  initialProfile: ArtistProfile | null
  /** Artist row from the `artists` table — used as fallback when no profile exists yet. */
  artist?: Artist | null
}

export function usePortalProfileForm({
  artistId,
  initialProfile,
  artist,
}: UsePortalProfileFormOptions) {
  const t = useTranslations('portal')
  const tErrors = useTranslations('errors')
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(artist?.imageUrl)
  const [photoDirty, setPhotoDirty] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const isUploading = uploadProgress !== null && uploadProgress < 100
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Rider document URLs (managed separately from the main form)
  const [riderUrls, setRiderUrls] = useState<Record<RiderType, string | undefined>>({
    stage_plot: initialProfile?.riderStagePlotUrl,
    technical: initialProfile?.riderTechnicalUrl,
    hospitality: initialProfile?.riderHospitalityUrl,
  })
  const [ridersDirty, setRidersDirty] = useState(false)
  const [riderUploading, setRiderUploading] = useState<RiderType | null>(null)

  // Gallery photos (managed separately from the main form)
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>(initialProfile?.epkGalleryPhotos ?? [])
  const [galleryDirty, setGalleryDirty] = useState(false)
  const [galleryUploading, setGalleryUploading] = useState(false)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      bio: coalesceNonEmpty(undefined, artist?.bio),
      bio_short: coalesceNonEmpty(initialProfile?.bioShort, artist?.bio),
      bio_medium: coalesceNonEmpty(initialProfile?.bioMedium, artist?.bio),
      bio_long: coalesceNonEmpty(initialProfile?.bioLong, artist?.bio),
      genres: (artist?.genres ?? []).join(', '),
      press_quote: initialProfile?.pressQuote ?? '',
      founding_year: artist?.foundedYear?.toString() ?? '',
      hometown: artist?.hometown ?? '',
      booking_contact: initialProfile?.bookingContact ?? '',
      press_contact: initialProfile?.pressContact ?? '',
      website_url: artist?.websiteUrl ?? '',
      instagram_url: artist?.instagramUrl ?? '',
      youtube_url: artist?.youtubeUrl ?? '',
      bandcamp_url: artist?.bandcampUrl ?? '',
      spotify_url: artist?.spotifyUrl ?? '',
      apple_music_url: artist?.appleMusicUrl ?? '',
      tiktok_url: artist?.tiktokUrl ?? '',
      facebook_url: artist?.facebookUrl ?? '',
      soundcloud_url: artist?.soundcloudUrl ?? '',
      custom_links: initialProfile?.customLinks ?? [],
    },
  })

  const watched = useWatch({ control: form.control })

  // -------------------------------------------------------------------------
  // Photo upload
  // -------------------------------------------------------------------------

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0]
    if (!raw) return

    setUploadProgress(0)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error(t('profile_photoError'))
        return
      }

      // Auto-compress to stay within the 5 MB portal upload limit
      const file = raw.size > PORTAL_PHOTO_MAX_BYTES
        ? await compressImage(raw, { maxSizeBytes: PORTAL_PHOTO_MAX_BYTES })
        : raw

      const url = await uploadArtistPhoto(artistId, file, session.access_token, setUploadProgress)
      setPhotoUrl(url)
      setPhotoDirty(true)
      toast.success(t('profile_photoUploaded'))
    } catch {
      toast.error(t('profile_photoError'))
    } finally {
      setTimeout(() => setUploadProgress(null), 800)
    }
  }

  // -------------------------------------------------------------------------
  // Rider document upload / delete
  // -------------------------------------------------------------------------

  const handleRiderUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    riderType: RiderType,
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRiderUploading(riderType)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error(t('profile_rider_upload_error')); return }
      const url = await uploadRiderDocument(file, riderType, session.access_token, artistId)
      setRiderUrls((prev) => ({ ...prev, [riderType]: url }))
      setRidersDirty(true)
      toast.success(t('profile_rider_uploaded'))
    } catch {
      toast.error(t('profile_rider_upload_error'))
    } finally {
      setRiderUploading(null)
    }
  }

  const handleRiderDelete = async (riderType: RiderType) => {
    setRiderUrls((prev) => ({ ...prev, [riderType]: undefined }))
    setRidersDirty(true)
    toast.success(t('profile_rider_deleted'))
  }

  // -------------------------------------------------------------------------
  // Gallery photo upload / remove
  // -------------------------------------------------------------------------

  const persistGalleryPhotos = async (photos: string[]): Promise<boolean> => {
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error(tErrors('AUTH_TOKEN_INVALID'))
        return false
      }

      await saveArtistProfile(
        { artist_id: artistId, epk_gallery_photos: photos },
        session.access_token,
      )
      return true
    } catch (err) {
      if (err instanceof PortalProfileSaveError) {
        toast.error(getErrorMessage(err.body, tErrors))
      } else {
        toast.error(t('profile_error'))
      }
      return false
    }
  }

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0]
    if (!raw) return
    setGalleryUploading(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error(t('profile_photoError')); return }
      // Auto-compress to stay within the 5 MB portal upload limit
      const file = raw.size > PORTAL_PHOTO_MAX_BYTES
        ? await compressImage(raw, { maxSizeBytes: PORTAL_PHOTO_MAX_BYTES })
        : raw
      // Reuse the same upload endpoint — filename collision avoidance via timestamp
      const renamedFile = new File([file], `gallery-${Date.now()}-${file.name}`, { type: file.type })
      const url = await uploadArtistPhoto(artistId, renamedFile, session.access_token, () => {})
      let nextPhotos: string[] = []
      setGalleryPhotos((prev) => {
        nextPhotos = [...prev, url]
        return nextPhotos
      })
      setGalleryDirty(true)
      const saved = await persistGalleryPhotos(nextPhotos)
      if (saved) {
        toast.success(t('profile_photoUploaded'))
      }
    } catch {
      toast.error(t('profile_photoError'))
    } finally {
      setGalleryUploading(false)
      e.target.value = ''
    }
  }

  const handleGalleryRemove = async (url: string) => {
    const nextPhotos = galleryPhotos.filter((u) => u !== url)
    setGalleryPhotos(nextPhotos)
    setGalleryDirty(true)
    const saved = await persistGalleryPhotos(nextPhotos)
    if (saved) {
      toast.success(t('profile_saved'))
    }
  }

  // -------------------------------------------------------------------------
  // Form submission — partial payload (only dirty fields + dirty extras)
  // -------------------------------------------------------------------------

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error(tErrors('AUTH_TOKEN_INVALID'))
        return
      }

      const dirty = form.formState.dirtyFields
      const hasFormDirty = Object.keys(dirty).length > 0
      const hasExtraDirty = photoDirty || galleryDirty || ridersDirty

      if (!hasFormDirty && !hasExtraDirty) {
        toast.message(t('profile_saved'))
        return
      }

      type SavePayload = Parameters<typeof saveArtistProfile>[0]
      const payload: SavePayload = { artist_id: artistId }

      if (dirty.bio && values.bio?.trim()) payload.bio = values.bio
      if (dirty.bio_short) payload.bio_short = values.bio_short ?? null
      if (dirty.bio_medium) payload.bio_medium = values.bio_medium ?? null
      if (dirty.bio_long) payload.bio_long = values.bio_long ?? null
      if (dirty.genres) {
        payload.genres = values.genres
          ? values.genres.split(',').map((g) => g.trim()).filter(Boolean)
          : []
      }
      if (dirty.press_quote) payload.press_quote = values.press_quote ?? null
      if (dirty.founding_year) {
        const foundingYearNum = values.founding_year
          ? parseInt(values.founding_year, 10)
          : null
        payload.founding_year =
          foundingYearNum && !isNaN(foundingYearNum) ? foundingYearNum : null
      }
      if (dirty.hometown) {
        payload.hometown = values.hometown?.trim() ? values.hometown.trim() : null
      }
      if (dirty.booking_contact) payload.booking_contact = values.booking_contact || null
      if (dirty.press_contact) payload.press_contact = values.press_contact || null
      if (dirty.website_url) payload.website_url = values.website_url || null
      if (dirty.instagram_url) payload.instagram_url = values.instagram_url || null
      if (dirty.youtube_url) payload.youtube_url = values.youtube_url || null
      if (dirty.bandcamp_url) payload.bandcamp_url = values.bandcamp_url || null
      if (dirty.spotify_url) payload.spotify_url = values.spotify_url || null
      if (dirty.apple_music_url) payload.apple_music_url = values.apple_music_url || null
      if (dirty.tiktok_url) payload.tiktok_url = values.tiktok_url || null
      if (dirty.facebook_url) payload.facebook_url = values.facebook_url || null
      if (dirty.soundcloud_url) payload.soundcloud_url = values.soundcloud_url || null
      if (dirty.custom_links) {
        payload.custom_links = (values.custom_links ?? [])
          .filter((l) => l.label && l.url) as Array<{ label: string; url: string }>
      }

      if (photoDirty) {
        payload.image_url = photoUrl && photoUrl.trim() ? photoUrl.trim() : null
      }
      if (galleryDirty) {
        payload.epk_gallery_photos = galleryPhotos
      }
      if (ridersDirty) {
        payload.rider_stage_plot_url = riderUrls.stage_plot ?? null
        payload.rider_technical_url = riderUrls.technical ?? null
        payload.rider_hospitality_url = riderUrls.hospitality ?? null
      }

      await saveArtistProfile(payload, session.access_token)

      form.reset(values)
      setPhotoDirty(false)
      setGalleryDirty(false)
      setRidersDirty(false)
      toast.success(t('profile_saved'))
    } catch (err) {
      if (err instanceof PortalProfileSaveError) {
        toast.error(getErrorMessage(err.body, tErrors))
        return
      }
      toast.error(t('profile_error'))
    }
  }

  return {
    form,
    photoUrl,
    setPhotoUrl,
    uploadProgress,
    isUploading,
    fileInputRef,
    watched,
    riderUrls,
    riderUploading,
    galleryPhotos,
    galleryUploading,
    handlePhotoChange,
    handleRiderUpload,
    handleRiderDelete,
    handleGalleryUpload,
    handleGalleryRemove,
    onSubmit: form.handleSubmit(onSubmit),
  }
}
