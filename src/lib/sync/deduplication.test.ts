import { describe, it, expect } from 'vitest'
import {
  deduplicateReleases,
  findCrossSourceMergeTarget,
  normTitle,
  extractYear,
  type SpotifyReleaseInput,
  type DiscogsReleaseInput,
  type CrossSourceReleaseRow,
} from './deduplication'

const SPOTIFY_BASE: SpotifyReleaseInput = {
  spotifyId: 'sp1',
  title: 'Dark Matter',
  type: 'album',
  releaseDate: '2023-03-15',
  coverUrl: 'https://i.scdn.co/image/art.jpg',
  spotifyUrl: 'https://open.spotify.com/album/sp1',
  popularity: 72,
  barcode: '123456789012',
  isrc: null,
}

const DISCOGS_BASE: DiscogsReleaseInput = {
  discogsId: 'dc1',
  title: 'Dark Matter',
  artistName: 'Test Artist',
  releaseDate: '2023-04-01',
  coverUrl: 'https://discogs.com/art.jpg',
  catalogNumber: 'CAT-001',
  barcode: '123456789012',
  format: 'vinyl',
}

describe('deduplicateReleases', () => {
  it('merges Spotify and Discogs release by barcode', () => {
    const result = deduplicateReleases([SPOTIFY_BASE], [DISCOGS_BASE])

    expect(result).toHaveLength(1)
    const release = result[0]
    expect(release.spotifyId).toBe('sp1')
    expect(release.discogsId).toBe('dc1')
    expect(release.catalogNumber).toBe('CAT-001')
    expect(release.merged).toBe(true)
  })

  it('merges by normalised title + approximate year when no barcode match', () => {
    const spotify: SpotifyReleaseInput = { ...SPOTIFY_BASE, barcode: null, isrc: null }
    const discogs: DiscogsReleaseInput = { ...DISCOGS_BASE, barcode: null }

    const result = deduplicateReleases([spotify], [discogs])

    expect(result).toHaveLength(1)
    expect(result[0].merged).toBe(true)
  })

  it('does not merge when titles differ', () => {
    const discogs: DiscogsReleaseInput = {
      ...DISCOGS_BASE,
      barcode: null,
      title: 'Totally Different Album',
    }
    const spotify: SpotifyReleaseInput = { ...SPOTIFY_BASE, barcode: null }

    const result = deduplicateReleases([spotify], [discogs])

    expect(result).toHaveLength(2)
    expect(result[0].merged).toBe(false)
    expect(result[1].merged).toBe(false)
  })

  it('does not merge when years are more than 1 year apart', () => {
    const discogs: DiscogsReleaseInput = {
      ...DISCOGS_BASE,
      barcode: null,
      releaseDate: '2020-01-01',
    }
    const spotify: SpotifyReleaseInput = { ...SPOTIFY_BASE, barcode: null }

    const result = deduplicateReleases([spotify], [discogs])

    expect(result).toHaveLength(2)
    expect(result[0].merged).toBe(false)
  })

  it('includes unmatched Discogs releases as standalone entries', () => {
    const result = deduplicateReleases([], [DISCOGS_BASE])

    expect(result).toHaveLength(1)
    expect(result[0].discogsId).toBe('dc1')
    expect(result[0].spotifyId).toBeNull()
    expect(result[0].merged).toBe(false)
  })

  it('returns empty array when both inputs are empty', () => {
    expect(deduplicateReleases([], [])).toHaveLength(0)
  })

  it('handles multiple Spotify releases matched to different Discogs releases', () => {
    const spotify1: SpotifyReleaseInput = { ...SPOTIFY_BASE, spotifyId: 'sp1', barcode: 'bc1' }
    const spotify2: SpotifyReleaseInput = {
      ...SPOTIFY_BASE,
      spotifyId: 'sp2',
      title: 'Another Album',
      barcode: 'bc2',
    }
    const discogs1: DiscogsReleaseInput = { ...DISCOGS_BASE, discogsId: 'dc1', barcode: 'bc1' }
    const discogs2: DiscogsReleaseInput = {
      ...DISCOGS_BASE,
      discogsId: 'dc2',
      title: 'Another Album',
      barcode: 'bc2',
    }

    const result = deduplicateReleases([spotify1, spotify2], [discogs1, discogs2])

    expect(result).toHaveLength(2)
    expect(result[0].spotifyId).toBe('sp1')
    expect(result[0].discogsId).toBe('dc1')
    expect(result[1].spotifyId).toBe('sp2')
    expect(result[1].discogsId).toBe('dc2')
  })

  it('does not double-match a Discogs release to two Spotify releases', () => {
    const spotify1: SpotifyReleaseInput = { ...SPOTIFY_BASE, spotifyId: 'sp1', barcode: null }
    const spotify2: SpotifyReleaseInput = { ...SPOTIFY_BASE, spotifyId: 'sp2', barcode: null }
    const discogs: DiscogsReleaseInput = { ...DISCOGS_BASE, barcode: null }

    const result = deduplicateReleases([spotify1, spotify2], [discogs])

    // Only one spotify should match the discogs release
    const mergedCount = result.filter((r) => r.merged).length
    expect(mergedCount).toBe(1)
    expect(result).toHaveLength(2)
  })

  it('uses Spotify cover art over Discogs when available', () => {
    const result = deduplicateReleases([SPOTIFY_BASE], [DISCOGS_BASE])
    expect(result[0].coverUrl).toBe(SPOTIFY_BASE.coverUrl)
  })
})

describe('normTitle / extractYear', () => {
  it('normalises punctuation and casing', () => {
    expect(normTitle('Dark Matter (Deluxe)')).toBe('dark matter deluxe')
  })

  it('extracts year from ISO date strings', () => {
    expect(extractYear('2023-03-15')).toBe(2023)
    expect(extractYear('2020')).toBe(2020)
    expect(extractYear(null)).toBeNull()
  })
})

describe('findCrossSourceMergeTarget', () => {
  const spotifyRow: CrossSourceReleaseRow = {
    id: 'rel-spotify',
    title: 'Dark Matter',
    release_date: '2023-03-15',
    spotify_id: 'sp1',
    itunes_id: null,
  }

  it('merges iTunes into an existing Spotify row by title + year', () => {
    const target = findCrossSourceMergeTarget([spotifyRow], 'Dark Matter', '2023-04-01')
    expect(target?.id).toBe('rel-spotify')
  })

  it('skips rows that already have an itunes_id', () => {
    const rowWithItunes: CrossSourceReleaseRow = { ...spotifyRow, itunes_id: 'it1' }
    expect(findCrossSourceMergeTarget([rowWithItunes], 'Dark Matter', '2023-03-15')).toBeNull()
  })

  it('skips rows without spotify_id', () => {
    const itunesOnly: CrossSourceReleaseRow = { ...spotifyRow, spotify_id: null }
    expect(findCrossSourceMergeTarget([itunesOnly], 'Dark Matter', '2023-03-15')).toBeNull()
  })

  it('returns null when years differ by more than one year', () => {
    expect(findCrossSourceMergeTarget([spotifyRow], 'Dark Matter', '2020-01-01')).toBeNull()
  })

  it('returns null when titles differ', () => {
    expect(findCrossSourceMergeTarget([spotifyRow], 'Other Album', '2023-03-15')).toBeNull()
  })
})
