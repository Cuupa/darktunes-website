import { describe, expect, it } from 'vitest'
import type { Release } from '@/types'
import {
  applyCalendarFilters,
  filterReleasesBySearch,
  filterReleasesByScope,
  filterReleasesByType,
  formatReleaseCellLabel,
  getReleaseArtistNames,
  releaseIsInMonth,
  sortReleases,
} from './calendarFilters'

function makeRelease(overrides: Partial<Release> = {}): Release {
  return {
    id: 'r1',
    title: 'Alpha',
    artistId: 'a1',
    artistName: 'Artist One',
    releaseDate: '2026-06-15',
    coverArt: '',
    type: 'single',
    featured: false,
    isVisible: true,
    isPromo: false,
    ...overrides,
  }
}

describe('getReleaseArtistNames', () => {
  it('joins junction artists when present', () => {
    const release = makeRelease({
      artists: [
        { id: 'a1', name: 'Extize', slug: 'extize' },
        { id: 'a2', name: 'Guest', slug: 'guest' },
      ],
    })
    expect(getReleaseArtistNames(release)).toBe('Extize, Guest')
  })

  it('falls back to artistName', () => {
    expect(getReleaseArtistNames(makeRelease())).toBe('Artist One')
  })
})

describe('formatReleaseCellLabel', () => {
  it('includes artist names before title', () => {
    expect(formatReleaseCellLabel(makeRelease())).toBe('Artist One — Alpha')
  })
})

describe('filterReleasesByScope', () => {
  const releases = [
    makeRelease({ id: 'r1', artistId: 'a1' }),
    makeRelease({
      id: 'r2',
      artistId: 'a9',
      artists: [{ id: 'a2', name: 'Band B', slug: 'band-b' }],
    }),
  ]

  it('returns all releases for all scope', () => {
    expect(filterReleasesByScope(releases, 'all', 'a1')).toHaveLength(2)
  })

  it('returns only matching releases for mine scope', () => {
    const mine = filterReleasesByScope(releases, 'mine', 'a2')
    expect(mine).toHaveLength(1)
    expect(mine[0].id).toBe('r2')
  })
})

describe('filterReleasesByType', () => {
  const releases = [
    makeRelease({ id: 'r1', type: 'single' }),
    makeRelease({ id: 'r2', type: 'album' }),
  ]

  it('filters by release type', () => {
    expect(filterReleasesByType(releases, 'album')).toEqual([releases[1]])
  })
})

describe('filterReleasesBySearch', () => {
  const releases = [
    makeRelease({ id: 'r1', title: 'Dark Waves' }),
    makeRelease({ id: 'r2', title: 'Sunrise', artistName: 'Extize' }),
  ]

  it('matches title and artist name', () => {
    expect(filterReleasesBySearch(releases, 'extize')).toEqual([releases[1]])
    expect(filterReleasesBySearch(releases, 'dark')).toEqual([releases[0]])
  })
})

describe('sortReleases', () => {
  const releases = [
    makeRelease({ id: 'r1', title: 'Zulu', releaseDate: '2026-06-20' }),
    makeRelease({ id: 'r2', title: 'Alpha', releaseDate: '2026-06-10' }),
  ]

  it('sorts by date ascending', () => {
    expect(sortReleases(releases, 'date-asc').map((r) => r.id)).toEqual(['r2', 'r1'])
  })

  it('sorts by title ascending', () => {
    expect(sortReleases(releases, 'title-asc').map((r) => r.id)).toEqual(['r2', 'r1'])
  })
})

describe('applyCalendarFilters', () => {
  it('applies scope, type, search, and sort together', () => {
    const releases = [
      makeRelease({ id: 'r1', artistId: 'a1', type: 'single', title: 'Mine First', releaseDate: '2026-06-02' }),
      makeRelease({ id: 'r2', artistId: 'a1', type: 'album', title: 'Mine Album', releaseDate: '2026-06-01' }),
      makeRelease({ id: 'r3', artistId: 'a9', type: 'single', title: 'Other', releaseDate: '2026-06-03' }),
    ]

    const result = applyCalendarFilters(releases, {
      scope: 'mine',
      type: 'single',
      search: 'mine',
      sort: 'date-desc',
      currentArtistId: 'a1',
    })

    expect(result.map((r) => r.id)).toEqual(['r1'])
  })
})

describe('releaseIsInMonth', () => {
  it('returns true only for matching year and month', () => {
    expect(releaseIsInMonth(makeRelease({ releaseDate: '2026-06-15' }), 2026, 6)).toBe(true)
    expect(releaseIsInMonth(makeRelease({ releaseDate: '2026-06-15' }), 2026, 7)).toBe(false)
  })
})