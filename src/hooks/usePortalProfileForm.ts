/**
 * src/hooks/usePortalProfileForm.ts
 *
 * Encapsulates form state, photo-upload XHR, and profile-save networking
 * for the Artist Portal profile page.  Keeps the UI component (ProfileForm)
 * free of business / data logic (SRP).
 */

'use client'

import { useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { uploadArtistPhoto, uploadRiderDocument, saveArtistProfile } from '@/lib/api/portalProfile'
import type { RiderType } from '@/lib/api/portalProfile'
import type { ArtistProfile } from '@/lib/api/artistProfiles'
import type { Artist } from '@/types'
import type { Dictionary } from '@/i18n/types'

// ---------------------------------------------------------------------------
// Zod schema (shared with ProfileForm so both stay in sync)
// ---------------------------------------------------------------------------

const optionalUrl = z.string().url('Must be a valid URL').optional().or(z.literal(''))

export const profileSchema = z.object({
  bio: z.string().max(2000).optional(),
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
})

export type ProfileFormValues = z.infer<typeof profileSchema>

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UsePortalProfileFormOptions {
  artistId: string
  initialProfile: ArtistProfile | null
  /** Artist row from the `artists` table — used as fallback when no profile exists yet. */
  artist?: Artist | null
  dict: Dictionary['portal']
}

export function usePortalProfileForm({
  artistId,
  initialProfile,
  artist,
  dict,
}: UsePortalProfileFormOptions) {
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(initialProfile?.photoUrl)
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

  // EPK customisation settings (theme, section order, password)
  const [epkSettings, setEpkSettings] = useState<{
    epkTheme: string
    epkSectionsOrder: string[]
    epkSectionsHidden: string[]
    epkPasswordSections: string[]
    epkPasswordRaw?: string | null
  }>({
    epkTheme: initialProfile?.epkTheme ?? 'default',
    epkSectionsOrder: initialProfile?.epkSectionsOrder?.length ? initialProfile.epkSectionsOrder : ['header','quote','bio','info','contacts','riders','links'],
    epkSectionsHidden: initialProfile?.epkSectionsHidden ?? [],
    epkPasswordSections: initialProfile?.epkPasswordSections ?? [],
    epkPasswordRaw: undefined,
  })

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      bio: initialProfile?.bio ?? artist?.bio ?? '',
      bio_short: initialProfile?.bioShort ?? '',
      bio_medium: initialProfile?.bioMedium ?? '',
      bio_long: initialProfile?.bioLong ?? '',
      genres: (initialProfile?.genres.length ? initialProfile.genres : artist?.genres ?? []).join(', '),
      press_quote: initialProfile?.pressQuote ?? '',
      founding_year: initialProfile?.foundingYear?.toString() ?? artist?.foundedYear?.toString() ?? '',
      hometown: initialProfile?.hometown ?? '',
      booking_contact: initialProfile?.bookingContact ?? '',
      press_contact: initialProfile?.pressContact ?? '',
      website_url: initialProfile?.websiteUrl ?? artist?.websiteUrl ?? '',
      instagram_url: initialProfile?.instagramUrl ?? artist?.instagramUrl ?? '',
      youtube_url: initialProfile?.youtubeUrl ?? artist?.youtubeUrl ?? '',
      bandcamp_url: initialProfile?.bandcampUrl ?? artist?.bandcampUrl ?? '',
      spotify_url: initialProfile?.spotifyUrl ?? artist?.spotifyUrl ?? '',
      apple_music_url: initialProfile?.appleMusicUrl ?? artist?.appleMusicUrl ?? '',
      tiktok_url: initialProfile?.tiktokUrl ?? artist?.tiktokUrl ?? '',
      facebook_url: initialProfile?.facebookUrl ?? artist?.facebookUrl ?? '',
      soundcloud_url: initialProfile?.soundcloudUrl ?? '',
    },
  })

  const watched = useWatch({ control: form.control })

  // -------------------------------------------------------------------------
  // Photo upload
  // -------------------------------------------------------------------------

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

      const url = await uploadArtistPhoto(artistId, file, session.access_token, setUploadProgress)
      setPhotoUrl(url)
      toast.success(dict.profile_photoUploaded)
    } catch {
      toast.error(dict.profile_photoError)
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
      if (!session) { toast.error(dict.profile_rider_upload_error); return }
      const url = await uploadRiderDocument(file, riderType, session.access_token)
      setRiderUrls((prev) => ({ ...prev, [riderType]: url }))
      toast.success(dict.profile_rider_uploaded)
    } catch {
      toast.error(dict.profile_rider_upload_error)
    } finally {
      setRiderUploading(null)
    }
  }

  const handleRiderDelete = async (riderType: RiderType) => {
    setRiderUrls((prev) => ({ ...prev, [riderType]: undefined }))
    toast.success(dict.profile_rider_deleted)
  }

  // -------------------------------------------------------------------------
  // EPK settings change handler (called from EPKPreview child)
  // -------------------------------------------------------------------------

  const handleEpkSettingsChange = (updates: Partial<{
    epkTheme: string
    epkSectionsOrder: string[]
    epkSectionsHidden: string[]
    epkPasswordSections: string[]
    epkPasswordHash: string | undefined
  }>) => {
    setEpkSettings((prev) => {
      // Extract raw password from the __plain__ sentinel
      let epkPasswordRaw = prev.epkPasswordRaw
      if (updates.epkPasswordHash !== undefined) {
        const raw = updates.epkPasswordHash
        if (raw === undefined) {
          epkPasswordRaw = null // signal: clear password
        } else if (typeof raw === 'string' && raw.startsWith('__plain__')) {
          epkPasswordRaw = raw.slice('__plain__'.length) || null
        }
      }
      return {
        ...prev,
        ...(updates.epkTheme !== undefined ? { epkTheme: updates.epkTheme } : {}),
        ...(updates.epkSectionsOrder !== undefined ? { epkSectionsOrder: updates.epkSectionsOrder } : {}),
        ...(updates.epkSectionsHidden !== undefined ? { epkSectionsHidden: updates.epkSectionsHidden } : {}),
        ...(updates.epkPasswordSections !== undefined ? { epkPasswordSections: updates.epkPasswordSections } : {}),
        epkPasswordRaw,
      }
    })
  }

  // -------------------------------------------------------------------------
  // Form submission (includes rider URLs + EPK settings)
  // -------------------------------------------------------------------------

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        toast.error(dict.profile_error)
        return
      }

      const foundingYearNum = values.founding_year
        ? parseInt(values.founding_year, 10)
        : null

      await saveArtistProfile(
        {
          artist_id: artistId,
          bio: values.bio ?? null,
          bio_short: values.bio_short ?? null,
          bio_medium: values.bio_medium ?? null,
          bio_long: values.bio_long ?? null,
          photo_url: photoUrl ?? null,
          genres: values.genres
            ? values.genres.split(',').map((g) => g.trim()).filter(Boolean)
            : [],
          press_quote: values.press_quote ?? null,
          founding_year: foundingYearNum && !isNaN(foundingYearNum) ? foundingYearNum : null,
          hometown: values.hometown || null,
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
          rider_stage_plot_url: riderUrls.stage_plot ?? null,
          rider_technical_url: riderUrls.technical ?? null,
          rider_hospitality_url: riderUrls.hospitality ?? null,
          epk_theme: epkSettings.epkTheme,
          epk_sections_order: epkSettings.epkSectionsOrder,
          epk_sections_hidden: epkSettings.epkSectionsHidden,
          epk_password_sections: epkSettings.epkPasswordSections,
          ...(epkSettings.epkPasswordRaw !== undefined ? { epk_password_raw: epkSettings.epkPasswordRaw } : {}),
        },
        session.access_token,
      )

      toast.success(dict.profile_saved)
    } catch {
      toast.error(dict.profile_error)
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
    epkSettings,
    handlePhotoChange,
    handleRiderUpload,
    handleRiderDelete,
    handleEpkSettingsChange,
    onSubmit: form.handleSubmit(onSubmit),
  }
}
