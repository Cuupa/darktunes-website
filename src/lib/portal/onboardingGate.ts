import type { Artist } from '@/types'
import type { ArtistProfile } from '@/lib/api/artistProfiles'
import { isProfileComplete } from '@/lib/api/artistProfiles'

type ProfileCompleteCheck = (profile: ArtistProfile | null, artist?: Artist | null) => boolean

/**
 * Determines whether the portal layout should redirect to /portal/onboarding.
 */
export function shouldRedirectToOnboarding(
  _artist: Artist | null,
  _profile: ArtistProfile | null,
  _pathname: string,
  _checkComplete: ProfileCompleteCheck = isProfileComplete,
): boolean {
  // Temporarily disabled per product review (June 2026). Wizard code retained for re-enable.
  return false
}