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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const isUploading = uploadProgress !== null && uploadProgress < 100
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Rider document URLs (managed separately from the main form)
  const [riderUrls, setRiderUrls] = useState<Record<RiderType, string | undefined>>({
    stage_plot: initialProfile?.riderStagePlotUrl,
    technical: initialProfile?.riderTechnicalUrl,
    hospitality: initialProfile?.riderHospitalityUrl,
  })
  const [riderUploading, setRiderUploading] = useState<RiderType | null>(null)

  // Gallery photos (managed separately from the main form)
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>(initialProfile?.epkGalleryPhotos ?? [])
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
      toast.success(t('profile_rider_uploaded'))
    } catch {
      toast.error(t('profile_rider_upload_error'))
    } finally {
      setRiderUploading(null)
    }
  }

  const handleRiderDelete = async (riderType: RiderType) => {
    setRiderUrls((prev) => ({ ...prev, [riderType]: undefined }))
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
    const saved = await persistGalleryPhotos(nextPhotos)
    if (saved) {
      toast.success(t('profile_saved'))
    }
  }

  // -------------------------------------------------------------------------
  // Form submission (includes rider URLs + gallery photos)
  // -------------------------------------------------------------------------

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error(tErrors('AUTH_TOKEN_INVALID'))
        return
      }

      const foundingYearNum = values.founding_year
        ? parseInt(values.founding_year, 10)
        : null

      // Prefer a real photo URL; empty string must become null (?? only catches null/undefined).
      const imageUrl = photoUrl && photoUrl.trim() ? photoUrl.trim() : null

      await saveArtistProfile(
        {
          artist_id: artistId,
          image_url: imageUrl,
          // Only re-send label bio when present — omit when empty so we never
          // wipe artists.bio with null/'' from an unused form field.
          ...(values.bio?.trim() ? { bio: values.bio } : {}),
          bio_short: values.bio_short ?? null,
          bio_medium: values.bio_medium ?? null,
          bio_long: values.bio_long ?? null,
          genres: values.genres
            ? values.genres.split(',').map((g) => g.trim()).filter(Boolean)
            : [],
          press_quote: values.press_quote ?? null,
          founding_year: foundingYearNum && !isNaN(foundingYearNum) ? foundingYearNum : null,
          hometown: values.hometown?.trim() ? values.hometown.trim() : null,
          booking_contact: values.booking_contact || null,
          press_contact: values.press_contact || null,
          website_url: values.website_url || null,
          instagram_url: values.instagram_url || null,
          youtube_url: values.youtube_url || null,
          bandcamp_url: values.bandcamp_url || null,
          spotify_url: values.spotify_url || null,
          apple_music_url: values.apple_music_url || null,
          tiktok_url: values.tiktok_url || null,
          facebook_url: values.facebook_url || null,
          soundcloud_url: values.soundcloud_url || null,
          custom_links: (values.custom_links ?? []).filter((l) => l.label && l.url) as Array<{ label: string; url: string }> | null,
          rider_stage_plot_url: riderUrls.stage_plot ?? null,
          rider_technical_url: riderUrls.technical ?? null,
          rider_hospitality_url: riderUrls.hospitality ?? null,
          epk_gallery_photos: galleryPhotos,
        },
        session.access_token,
      )

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
