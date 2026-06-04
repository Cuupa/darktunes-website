import { describe, expect, it } from 'vitest'
import { DEFAULT_SECTION_ORDER, buildNavItems } from '@/config/sections'

describe('buildNavItems', () => {
  it('returns home first, configured sections in order, then artists, contact and shop', () => {
    const items = buildNavItems(['news', 'spotify', 'videos'])

    expect(items.map((item) => item.id)).toEqual(['home', 'news', 'spotify', 'videos', 'artists', 'contact', 'shop'])
    expect(items[2]).toMatchObject({ labelKey: 'spotify', href: '#spotify-player', routeType: 'anchor' })
  })

  it('uses the default section order when none is provided', () => {
    expect(buildNavItems().map((item) => item.id)).toEqual([
      'home',
      ...DEFAULT_SECTION_ORDER,
      'artists',
      'contact',
      'shop',
    ])
  })

  it('ignores duplicate and unknown sections from persisted settings', () => {
    expect(buildNavItems(['news', 'news', 'videos', 'unknown' as never]).map((item) => item.id)).toEqual([
      'home',
      'news',
      'videos',
      'artists',
      'contact',
      'shop',
    ])
  })
})
