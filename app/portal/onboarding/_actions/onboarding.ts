'use server'

/**
 * app/portal/onboarding/_actions/onboarding.ts
 *
 * Server Actions for the Artist Onboarding Wizard.
 *
 * saveOnboardingStep  — persists partial profile data for a single step.
 * completeOnboarding  — marks onboarding_completed = true (also persists final data).
 * skipOnboarding      — marks onboarding_completed = true without saving profile data.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getArtistByUserId, upsertArtistProfile } from '@/lib/api/artistProfiles'

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
    await upsertArtistProfile(supabase, {
      artist_id: artist.id,
      ...data,
    })
    return { ok: true }
  } catch (err) {
    console.error('[saveOnboardingStep]', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/**
 * Marks the onboarding as completed and saves any final data.
 */
export async function completeOnboarding(data?: {
  bio_short?: string | null
  instagram_url?: string | null
  spotify_url?: string | null
  website_url?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { supabase, artist } = await getCurrentArtist()
    await upsertArtistProfile(supabase, {
      artist_id: artist.id,
      ...data,
      onboarding_completed: true,
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
