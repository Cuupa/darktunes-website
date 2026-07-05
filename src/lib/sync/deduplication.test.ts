import { describe, it, expect } from 'vitest'
import {
  deduplicateReleases,
  findCrossSourceMergeTarget,
  registerSyncedRelease,
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

  it('merges Spotify and Discogs release by normalised title when iTunes EP suffix differs', () => {
    const spotify: SpotifyReleaseInput = {
      ...SPOTIFY_BASE,
      title: 'Nocturnal',
      barcode: null,
      isrc: null,
      releaseDate: '2023-01-01',
    }
    const discogs: DiscogsReleaseInput = {
      ...DISCOGS_BASE,
      title: 'Nocturnal - EP',
      barcode: null,
      releaseDate: '2023-01-01',
    }
    const result = deduplicateReleases([spotify], [discogs])
    expect(result).toHaveLength(1)
    expect(result[0].merged).toBe(true)
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

  it('strips iTunes " - EP" suffix', () => {
    expect(normTitle('Nocturnal - EP')).toBe('nocturnal')
  })

  it('strips iTunes " - Single" suffix', () => {
    expect(normTitle('Death Wish - Single')).toBe('death wish')
  })

  it('strips iTunes " - Album" suffix', () => {
    expect(normTitle('Dark Matter - Album')).toBe('dark matter')
  })

  it('strips iTunes " - LP" suffix', () => {
    expect(normTitle('Void - LP')).toBe('void')
  })

  it('makes " - EP" (iTunes) match the bare title (manual entry)', () => {
    expect(normTitle('Nocturnal - EP')).toBe(normTitle('Nocturnal'))
  })

  it('is case-insensitive for suffix stripping', () => {
    expect(normTitle('Nocturnal - ep')).toBe('nocturnal')
  })

  it('does not strip mid-title dashes', () => {
    expect(normTitle('Fire - Ice - EP')).toBe('fire ice')
  })

  it('extracts year from ISO date strings', () => {
    expect(extractYear('2023-03-15')).toBe(2023)
    expect(extractYear('2020')).toBe(2020)
    expect(extractYear(null)).toBeNull()
  })
})

describe('registerSyncedRelease', () => {
  it('appends new rows for non-merged inserts', () => {
    const existing: CrossSourceReleaseRow[] = []
    registerSyncedRelease(
      existing,
      {
        id: 'rel-new',
        title: 'Album',
        release_date: '2024-01-01',
        spotify_id: 'sp-1',
      },
      false,
    )
    expect(existing).toHaveLength(1)
    expect(existing[0].spotify_id).toBe('sp-1')
  })

  it('updates external IDs on merged rows', () => {
    const existing: CrossSourceReleaseRow[] = [
      {
        id: 'rel-manual',
        title: 'Album',
        release_date: '2024-01-01',
        spotify_id: null,
        itunes_id: null,
      },
    ]
    registerSyncedRelease(
      existing,
      {
        id: 'rel-manual',
        title: 'Album',
        release_date: '2024-01-01',
        spotify_id: 'sp-1',
      },
      true,
    )
    expect(existing[0].spotify_id).toBe('sp-1')
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
    const target = findCrossSourceMergeTarget(
      [spotifyRow],
      { title: 'Dark Matter', releaseDate: '2023-04-01' },
      'itunes',
    )
    expect(target?.id).toBe('rel-spotify')
  })

  it('skips rows that already have an itunes_id for iTunes source', () => {
    const rowWithItunes: CrossSourceReleaseRow = { ...spotifyRow, itunes_id: 'it1' }
    expect(
      findCrossSourceMergeTarget(
        [rowWithItunes],
        { title: 'Dark Matter', releaseDate: '2023-03-15' },
        'itunes',
      ),
    ).toBeNull()
  })

  it('merges into manual rows without external IDs', () => {
    const manualRow: CrossSourceReleaseRow = {
      id: 'rel-manual',
      title: 'Dark Matter',
      release_date: '2023-03-15',
      spotify_id: null,
      itunes_id: null,
    }
    const target = findCrossSourceMergeTarget(
      [manualRow],
      { title: 'Dark Matter', releaseDate: '2023-04-01' },
      'spotify',
    )
    expect(target?.id).toBe('rel-manual')
  })

  it('matches by ISRC before title', () => {
    const manualRow: CrossSourceReleaseRow = {
      id: 'rel-isrc',
      title: 'Different Title',
      release_date: '2020-01-01',
      spotify_id: null,
      itunes_id: null,
      isrc: 'US123',
    }
    const target = findCrossSourceMergeTarget(
      [manualRow],
      { title: 'Other', releaseDate: '2024-01-01', isrc: 'US123' },
      'spotify',
    )
    expect(target?.id).toBe('rel-isrc')
  })

  it('merges iTunes " - EP" title into manual row with bare title', () => {
    const manualRow: CrossSourceReleaseRow = {
      id: 'rel-manual-ep',
      title: 'Nocturnal',
      release_date: '2022-06-01',
      spotify_id: null,
      itunes_id: null,
    }
    const target = findCrossSourceMergeTarget(
      [manualRow],
      { title: 'Nocturnal - EP', releaseDate: '2022-06-15' },
      'itunes',
    )
    expect(target?.id).toBe('rel-manual-ep')
  })

  it('returns null when years differ by more than one year', () => {
    expect(
      findCrossSourceMergeTarget(
        [spotifyRow],
        { title: 'Dark Matter', releaseDate: '2020-01-01' },
        'itunes',
      ),
    ).toBeNull()
  })

  it('returns null when titles differ', () => {
    expect(
      findCrossSourceMergeTarget(
        [spotifyRow],
        { title: 'Other Album', releaseDate: '2023-03-15' },
        'itunes',
      ),
    ).toBeNull()
  })
})
