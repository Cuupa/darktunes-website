import type { Artist } from '@/types'
import type { ArtistProfile } from '@/lib/api/artistProfiles'
import { isProfileComplete } from '@/lib/api/artistProfiles'

type ProfileCompleteCheck = (profile: ArtistProfile | null, artist?: Artist | null) => boolean

/**
 * Determines whether the portal layout should redirect to /portal/onboarding.
 */
export function shouldRedirectToOnboarding(
  artist: Artist | null,
  profile: ArtistProfile | null,
  pathname: string,
  checkComplete: ProfileCompleteCheck = isProfileComplete,
): boolean {
  if (!artist) return false
  if (pathname.startsWith('/portal/onboarding')) return false

  if (profile === null) return true

  return !profile.onboardingCompleted && !checkComplete(profile, artist)
}