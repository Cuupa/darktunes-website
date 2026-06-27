import { describe, expect, it } from 'vitest'
import { groupPortalFeatureFlags, portalFeatureFlagDescriptionKey } from './portalFeatureFlagMeta'
import type { PortalFeatureFlag } from '@/types'

function makeFlag(id: string, targetRole: 'artist' | 'journalist'): PortalFeatureFlag {
  return {
    id,
    label: id,
    enabled: true,
    targetRole,
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

describe('groupPortalFeatureFlags', () => {
  it('groups flags by target role in stable order', () => {
    const grouped = groupPortalFeatureFlags([
      makeFlag('press.contact', 'journalist'),
      makeFlag('artist.calendar', 'artist'),
      makeFlag('artist.analytics', 'artist'),
    ])

    expect(grouped.map((g) => g.role)).toEqual(['artist', 'journalist'])
    expect(grouped[0].flags.map((f) => f.id)).toEqual(['artist.calendar', 'artist.analytics'])
    expect(grouped[1].flags.map((f) => f.id)).toEqual(['press.contact'])
  })

  it('omits empty role groups', () => {
    const grouped = groupPortalFeatureFlags([makeFlag('artist.analytics', 'artist')])
    expect(grouped).toHaveLength(1)
    expect(grouped[0].role).toBe('artist')
  })
})

describe('portalFeatureFlagDescriptionKey', () => {
  it('maps dotted flag ids to nested i18n paths', () => {
    expect(portalFeatureFlagDescriptionKey('artist.analytics')).toBe('flagDescriptions.artist.analytics')
    expect(portalFeatureFlagDescriptionKey('press.zip_download')).toBe('flagDescriptions.press.zip_download')
  })
})