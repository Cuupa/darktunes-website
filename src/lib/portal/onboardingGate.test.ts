import { describe, expect, it } from 'vitest'
import type { Artist } from '@/types'
import type { ArtistProfile } from '@/lib/api/artistProfiles'
import { shouldRedirectToOnboarding } from './onboardingGate'

const artist: Artist = {
  id: 'a1',
  name: 'Test',
  slug: 'test',
  bio: '',
  genres: [],
  imageUrl: '',
  featured: false,
  isVisible: true,
}

const completeProfile = {
  id: 'p1',
  artistId: 'a1',
  onboardingCompleted: true,
} as ArtistProfile

describe('shouldRedirectToOnboarding', () => {
  it('is temporarily disabled and always returns false', () => {
    expect(shouldRedirectToOnboarding(null, null, '/portal')).toBe(false)
    expect(shouldRedirectToOnboarding(artist, null, '/portal/onboarding')).toBe(false)
    expect(shouldRedirectToOnboarding(artist, null, '/portal')).toBe(false)
    expect(shouldRedirectToOnboarding(artist, completeProfile, '/portal')).toBe(false)

    const profile = { ...completeProfile, onboardingCompleted: false }
    const check = () => false
    expect(shouldRedirectToOnboarding(artist, profile, '/portal', check)).toBe(false)
  })
})