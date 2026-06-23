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
  it('returns false when artist is null', () => {
    expect(shouldRedirectToOnboarding(null, null, '/portal')).toBe(false)
  })

  it('returns false when already on onboarding route', () => {
    expect(shouldRedirectToOnboarding(artist, null, '/portal/onboarding')).toBe(false)
  })

  it('returns true when profile row is missing', () => {
    expect(shouldRedirectToOnboarding(artist, null, '/portal')).toBe(true)
  })

  it('returns false when onboarding is completed', () => {
    expect(shouldRedirectToOnboarding(artist, completeProfile, '/portal')).toBe(false)
  })

  it('returns true when profile is incomplete and onboarding not completed', () => {
    const profile = { ...completeProfile, onboardingCompleted: false }
    const check = () => false
    expect(shouldRedirectToOnboarding(artist, profile, '/portal', check)).toBe(true)
  })
})