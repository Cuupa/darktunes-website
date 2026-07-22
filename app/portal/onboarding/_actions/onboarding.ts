'use server'

/**
 * app/portal/onboarding/_actions/onboarding.ts
 *
 * Server Actions for the Artist Onboarding Wizard.
 *
 * saveOnboardingStep  — persists partial profile data for a single step.
 * completeOnboarding  — marks onboarding_completed = true (also persists final data)
 *                       and sends an automatic welcome message to the artist inbox.
 * skipOnboarding      — marks onboarding_completed = true without saving profile data.
 *
 * After membership is verified, writes use the service-role client so band members
 * are not blocked by legacy RLS on artists / artist_epks / label_messages.
 */

import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist, upsertArtistProfile } from '@/lib/api/artistProfiles'
import { portalWriteWithCanary } from '@/lib/portal/portalWriteClient'
import { getTranslations } from 'next-intl/server'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function getCurrentArtist(artistId?: string | null) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')

  let artist
  try {
    artist = await resolvePortalArtist(supabase, user.id, artistId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new Error('No artist linked to this account')
    throw err
  }

  if (!artist) throw new Error('No artist linked to this account')
  return { supabase, artist, userId: user.id }
}

// ---------------------------------------------------------------------------
// Exported server actions
// ---------------------------------------------------------------------------

/**
 * Persists partial profile data for the current onboarding step.
 * Accepts only the fields relevant to the wizard (subset of the full profile).
 * Social/streaming URLs (instagram_url, spotify_url, website_url) and image_url
 * are stored in the artists table only — written directly here without going via artist_epks.
 */
export async function saveOnboardingStep(
  artistId: string,
  data: {
    image_url?: string | null
    bio_short?: string | null
    instagram_url?: string | null
    spotify_url?: string | null
    website_url?: string | null
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase, artist, userId } = await getCurrentArtist(artistId)
    const serviceDb = await createServiceRoleSupabaseClient()
    const ctx = {
      route: 'onboarding/saveOnboardingStep',
      artistId: artist.id,
      userId,
    }

    // Profile-specific fields only (bio)
    const { instagram_url, spotify_url, website_url, image_url, ...profileFields } = data
    await portalWriteWithCanary({
      userDb: supabase,
      serviceDb,
      context: { ...ctx, table: 'artist_epks', operation: 'upsert' },
      write: (db) =>
        upsertArtistProfile(db, {
          artist_id: artist.id,
          ...profileFields,
        }),
    })

    // URL fields and image_url go to the artists table (single source of truth)
    const artistUpdate: {
      instagram_url?: string | null
      spotify_url?: string | null
      website_url?: string | null
      image_url?: string | null
    } = {}
    if (instagram_url !== undefined) artistUpdate.instagram_url = instagram_url
    if (spotify_url !== undefined) artistUpdate.spotify_url = spotify_url
    if (website_url !== undefined) artistUpdate.website_url = website_url
    if (image_url !== undefined) artistUpdate.image_url = image_url
    if (Object.keys(artistUpdate).length > 0) {
      await portalWriteWithCanary({
        userDb: supabase,
        serviceDb,
        context: { ...ctx, table: 'artists', operation: 'update' },
        write: async (db) => {
          const { error } = await db.from('artists').update(artistUpdate).eq('id', artist.id)
          if (error) throw new Error(error.message)
        },
      })
    }

    return { ok: true }
  } catch (err) {
    console.error('[saveOnboardingStep]', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Marks the onboarding as completed and saves any final data.
 * Also inserts a welcome message into the artist's label inbox.
 */
export async function completeOnboarding(
  artistId: string,
  data?: {
    bio_short?: string | null
    instagram_url?: string | null
    spotify_url?: string | null
    website_url?: string | null
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase, artist, userId } = await getCurrentArtist(artistId)
    const serviceDb = await createServiceRoleSupabaseClient()
    const ctx = {
      route: 'onboarding/completeOnboarding',
      artistId: artist.id,
      userId,
    }

    const { instagram_url, spotify_url, website_url, ...profileFields } = data ?? {}
    await portalWriteWithCanary({
      userDb: supabase,
      serviceDb,
      context: { ...ctx, table: 'artist_epks', operation: 'upsert' },
      write: (db) =>
        upsertArtistProfile(db, {
          artist_id: artist.id,
          ...profileFields,
          onboarding_completed: true,
        }),
    })

    // URL fields go to the artists table (single source of truth)
    const artistUpdate: {
      instagram_url?: string | null
      spotify_url?: string | null
      website_url?: string | null
    } = {}
    if (instagram_url !== undefined) artistUpdate.instagram_url = instagram_url
    if (spotify_url !== undefined) artistUpdate.spotify_url = spotify_url
    if (website_url !== undefined) artistUpdate.website_url = website_url
    if (Object.keys(artistUpdate).length > 0) {
      await portalWriteWithCanary({
        userDb: supabase,
        serviceDb,
        context: { ...ctx, table: 'artists', operation: 'update' },
        write: async (db) => {
          const { error } = await db.from('artists').update(artistUpdate).eq('id', artist.id)
          if (error) throw new Error(error.message)
        },
      })
    }

    // Welcome message: artists only have SELECT on label_messages — always service role.
    const t = await getTranslations('portal')
    const { error: msgError } = await serviceDb.from('label_messages').insert({
      artist_id: artist.id,
      subject: t('welcome_message_subject'),
      body: t('welcome_message_body'),
      body_html: t('welcome_message_body'),
      read: false,
    })
    if (msgError) {
      // Profile save succeeded — do not fail onboarding over a welcome-message glitch.
      console.error('[completeOnboarding] welcome message insert failed:', msgError)
    }

    return { ok: true }
  } catch (err) {
    console.error('[completeOnboarding]', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Skips the onboarding wizard without filling in profile data.
 */
export async function skipOnboarding(artistId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase, artist, userId } = await getCurrentArtist(artistId)
    const serviceDb = await createServiceRoleSupabaseClient()
    await portalWriteWithCanary({
      userDb: supabase,
      serviceDb,
      context: {
        route: 'onboarding/skipOnboarding',
        table: 'artist_epks',
        operation: 'upsert',
        artistId: artist.id,
        userId,
      },
      write: (db) =>
        upsertArtistProfile(db, {
          artist_id: artist.id,
          onboarding_completed: true,
        }),
    })
    return { ok: true }
  } catch (err) {
    console.error('[skipOnboarding]', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
