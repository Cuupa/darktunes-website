/**
 * src/lib/portal/profileCompletion.ts
 *
 * Calculates a profile completion score (0–100) for an artist, based on
 * both the core Artist record and the extended ArtistProfile EPK data.
 *
 * Used in the portal dashboard to nudge artists towards a complete profile.
 */

import type { Artist } from '@/types'
import type { ArtistProfile } from '@/lib/api/artistProfiles'
import type { Dictionary } from '@/i18n/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompletionField {
  /** Unique identifier, matches a completion_field_* i18n key suffix */
  key: string
  /** i18n label key (within dict.portal) */
  labelKey: keyof Dictionary['portal']
  /** Weight of this field out of the total */
  weight: number
}

export interface CompletionResult {
  /** 0–100 rounded integer */
  score: number
  /** Fields that are still missing */
  missing: CompletionField[]
}

// ---------------------------------------------------------------------------
// Field definitions
// ---------------------------------------------------------------------------

export const COMPLETION_FIELDS: CompletionField[] = [
  { key: 'photo',     labelKey: 'completion_field_photo',     weight: 20 },
  { key: 'bio',       labelKey: 'completion_field_bio',       weight: 20 },
  { key: 'genres',    labelKey: 'completion_field_genres',    weight: 10 },
  { key: 'spotify',   labelKey: 'completion_field_spotify',   weight: 15 },
  { key: 'instagram', labelKey: 'completion_field_instagram', weight: 15 },
  { key: 'website',   labelKey: 'completion_field_website',   weight: 10 },
  { key: 'country',   labelKey: 'completion_field_country',   weight: 10 },
]

const TOTAL_WEIGHT = COMPLETION_FIELDS.reduce((sum, f) => sum + f.weight, 0)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isFieldFilled(key: string, artist: Artist, profile: ArtistProfile | null): boolean {
  switch (key) {
    case 'photo':
      return Boolean(profile?.photoUrl || artist.imageUrl)
    case 'bio':
      return Boolean(
        profile?.bioShort || profile?.bioMedium || profile?.bioLong || profile?.bio || artist.bio,
      )
    case 'genres':
      return (profile?.genres ?? artist.genres).length > 0
    case 'spotify':
      return Boolean(profile?.spotifyUrl || artist.spotifyUrl)
    case 'instagram':
      return Boolean(profile?.instagramUrl || artist.instagramUrl)
    case 'website':
      return Boolean(profile?.websiteUrl || artist.websiteUrl)
    case 'country':
      return Boolean(artist.country)
    default:
      return false
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculates the profile completion score.
 *
 * @param artist  - Core artist record (from the `artists` table)
 * @param profile - Extended EPK profile (from `artist_profiles`, may be null)
 * @returns       { score: 0–100, missing: CompletionField[] }
 */
export function calcProfileCompletion(
  artist: Artist,
  profile: ArtistProfile | null,
): CompletionResult {
  const missing: CompletionField[] = []
  let filledWeight = 0

  for (const field of COMPLETION_FIELDS) {
    if (isFieldFilled(field.key, artist, profile)) {
      filledWeight += field.weight
    } else {
      missing.push(field)
    }
  }

  const score = Math.round((filledWeight / TOTAL_WEIGHT) * 100)
  return { score, missing }
}
