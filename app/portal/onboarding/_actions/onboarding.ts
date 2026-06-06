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
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId, upsertArtistProfile } from '@/lib/api/artistProfiles'
import { getDictionary, getLocale } from '@/i18n/getDictionary'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function getCurrentArtist() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')
  const artist = await getArtistByUserId(supabase, user.id)
  if (!artist) throw new Error('No artist linked to this account')
  return { supabase, artist }
}

// ---------------------------------------------------------------------------
// Exported server actions
// ---------------------------------------------------------------------------

/**
 * Persists partial profile data for the current onboarding step.
 * Accepts only the fields relevant to the wizard (subset of the full profile).
 * Social/streaming URLs (instagram_url, spotify_url, website_url) are stored
 * in the artists table only — written directly here without going via artist_profiles.
 */
export async function saveOnboardingStep(data: {
  photo_url?: string | null
  bio_short?: string | null
  instagram_url?: string | null
  spotify_url?: string | null
  website_url?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase, artist } = await getCurrentArtist()

    // Profile-specific fields only (bio, photo)
    const { instagram_url, spotify_url, website_url, ...profileFields } = data
    await upsertArtistProfile(supabase, {
      artist_id: artist.id,
      ...profileFields,
    })

    // URL fields go to the artists table (single source of truth)
    const artistUpdate: { instagram_url?: string | null; spotify_url?: string | null; website_url?: string | null } = {}
    if (instagram_url !== undefined) artistUpdate.instagram_url = instagram_url
    if (spotify_url !== undefined) artistUpdate.spotify_url = spotify_url
    if (website_url !== undefined) artistUpdate.website_url = website_url
    if (Object.keys(artistUpdate).length > 0) {
      await supabase.from('artists').update(artistUpdate).eq('id', artist.id)
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
export async function completeOnboarding(data?: {
  bio_short?: string | null
  instagram_url?: string | null
  spotify_url?: string | null
  website_url?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase, artist } = await getCurrentArtist()

    const { instagram_url, spotify_url, website_url, ...profileFields } = data ?? {}
    await upsertArtistProfile(supabase, {
      artist_id: artist.id,
      ...profileFields,
      onboarding_completed: true,
    })

    // URL fields go to the artists table (single source of truth)
    const artistUpdate: { instagram_url?: string | null; spotify_url?: string | null; website_url?: string | null } = {}
    if (instagram_url !== undefined) artistUpdate.instagram_url = instagram_url
    if (spotify_url !== undefined) artistUpdate.spotify_url = spotify_url
    if (website_url !== undefined) artistUpdate.website_url = website_url
    if (Object.keys(artistUpdate).length > 0) {
      await supabase.from('artists').update(artistUpdate).eq('id', artist.id)
    }

    // Send an automatic welcome message to the artist's inbox
    const locale = await getLocale()
    const dict = await getDictionary(locale)
    await supabase.from('label_messages').insert({
      artist_id: artist.id,
      subject: dict.portal.welcome_message_subject,
      body: dict.portal.welcome_message_body,
      body_html: dict.portal.welcome_message_body,
      read: false,
    })

    return { ok: true }
  } catch (err) {
    console.error('[completeOnboarding]', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Skips the onboarding wizard without filling in profile data.
 */
export async function skipOnboarding(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase, artist } = await getCurrentArtist()
    await upsertArtistProfile(supabase, {
      artist_id: artist.id,
      onboarding_completed: true,
    })
    return { ok: true }
  } catch (err) {
    console.error('[skipOnboarding]', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
