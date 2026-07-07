import { describe, it, expect, vi } from 'vitest'
import {
  deduplicateReleases,
  findCrossSourceMergeTarget,
  registerSyncedRelease,
  normTitle,
  extractYear,
  isManualRow,
  pruneOrphanedDuplicates,
  type SpotifyReleaseInput,
  type DiscogsReleaseInput,
  type CrossSourceReleaseRow,
} from './deduplication'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

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
    const spotify2: SpotifyReleaseInput = {
      ...SPOTIFY_BASE,
      spotifyId: 'sp2',
      barcode: null,
      releaseDate: '2024-03-15',
    }
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

  it('merges "Cut - Single" into "Cut" when both have same normTitle + year', () => {
    const spotify1: SpotifyReleaseInput = {
      ...SPOTIFY_BASE,
      spotifyId: 'sp1',
      title: 'Cut',
      type: 'single',
      releaseDate: '2023-01-01',
      popularity: 80,
      barcode: null,
    }
    const spotify2: SpotifyReleaseInput = {
      ...SPOTIFY_BASE,
      spotifyId: 'sp2',
      title: 'Cut - Single',
      type: 'single',
      releaseDate: '2023-03-01',
      popularity: 65,
      barcode: null,
    }

    const result = deduplicateReleases([spotify1, spotify2], [])

    expect(result).toHaveLength(1)
    expect(result[0].spotifyId).toBe('sp1')
    expect(result[0].title).toBe('Cut')
    expect(result[0].merged).toBe(true)
  })

  it('keeps the entry with higher popularity as the intra-Spotify primary', () => {
    const spotify1: SpotifyReleaseInput = {
      ...SPOTIFY_BASE,
      spotifyId: 'sp1',
      title: 'Cut',
      type: 'single',
      releaseDate: '2023-01-01',
      popularity: 95,
      barcode: null,
    }
    const spotify2: SpotifyReleaseInput = {
      ...SPOTIFY_BASE,
      spotifyId: 'sp2',
      title: 'Cut - Single',
      type: 'single',
      releaseDate: '2023-03-01',
      popularity: 20,
      barcode: null,
    }

    const result = deduplicateReleases([spotify2, spotify1], [])

    expect(result).toHaveLength(1)
    expect(result[0].spotifyId).toBe('sp1')
    expect(result[0].popularity).toBe(95)
  })

  it('carries over discogs metadata from the merged-away Spotify entry', () => {
    const spotify1: SpotifyReleaseInput = {
      ...SPOTIFY_BASE,
      spotifyId: 'sp1',
      title: 'Cut',
      type: 'single',
      releaseDate: '2023-01-01',
      popularity: 90,
      barcode: null,
    }
    const spotify2: SpotifyReleaseInput = {
      ...SPOTIFY_BASE,
      spotifyId: 'sp2',
      title: 'Cut - Single',
      type: 'single',
      releaseDate: '2023-03-01',
      popularity: 40,
      barcode: null,
      isrc: null,
    }
    const discogs: DiscogsReleaseInput = {
      ...DISCOGS_BASE,
      discogsId: 'dc-cut',
      title: 'Cut - Single',
      releaseDate: '2023-02-01',
      barcode: '999888777666',
      catalogNumber: 'CUT-001',
    }

    const result = deduplicateReleases([spotify2, spotify1], [discogs])

    expect(result).toHaveLength(1)
    expect(result[0].spotifyId).toBe('sp1')
    expect(result[0].discogsId).toBe('dc-cut')
    expect(result[0].barcode).toBe('999888777666')
    expect(result[0].catalogNumber).toBe('CUT-001')
    expect(result[0].merged).toBe(true)
  })

  it('does not merge intra-Spotify duplicates when years differ by more than 1', () => {
    const spotify1: SpotifyReleaseInput = {
      ...SPOTIFY_BASE,
      spotifyId: 'sp1',
      title: 'Cut',
      type: 'single',
      releaseDate: '2023-01-01',
      barcode: null,
    }
    const spotify2: SpotifyReleaseInput = {
      ...SPOTIFY_BASE,
      spotifyId: 'sp2',
      title: 'Cut - Single',
      type: 'single',
      releaseDate: '2025-01-01',
      barcode: null,
    }

    const result = deduplicateReleases([spotify1, spotify2], [])

    expect(result).toHaveLength(2)
    expect(result.every((release) => release.merged === false)).toBe(true)
  })

  it('does not merge intra-Spotify duplicates when normTitles differ', () => {
    const spotify1: SpotifyReleaseInput = {
      ...SPOTIFY_BASE,
      spotifyId: 'sp1',
      title: 'Cut',
      type: 'single',
      releaseDate: '2023-01-01',
      barcode: null,
    }
    const spotify2: SpotifyReleaseInput = {
      ...SPOTIFY_BASE,
      spotifyId: 'sp2',
      title: 'Different Cut - Single',
      type: 'single',
      releaseDate: '2023-03-01',
      barcode: null,
    }

    const result = deduplicateReleases([spotify1, spotify2], [])

    expect(result).toHaveLength(2)
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

  it('returns same-source spotify row when normTitle + exact year match', () => {
    const target = findCrossSourceMergeTarget(
      [
        {
          id: 'rel-cut',
          title: 'Cut',
          release_date: '2023-01-01',
          spotify_id: 'sp1',
          itunes_id: null,
        },
      ],
      { title: 'Cut - Single', releaseDate: '2023-09-09' },
      'spotify',
    )

    expect(target?.id).toBe('rel-cut')
  })

  it('does not return same-source spotify row when years differ', () => {
    expect(
      findCrossSourceMergeTarget(
        [
          {
            id: 'rel-cut',
            title: 'Cut',
            release_date: '2022-01-01',
            spotify_id: 'sp1',
            itunes_id: null,
          },
        ],
        { title: 'Cut - Single', releaseDate: '2023-09-09' },
        'spotify',
      ),
    ).toBeNull()
  })

  it('does not return same-source spotify row when titles differ', () => {
    expect(
      findCrossSourceMergeTarget(
        [
          {
            id: 'rel-cut',
            title: 'Different Release',
            release_date: '2023-01-01',
            spotify_id: 'sp1',
            itunes_id: null,
          },
        ],
        { title: 'Cut - Single', releaseDate: '2023-09-09' },
        'spotify',
      ),
    ).toBeNull()
  })

  it('prefers cross-source match over same-source self-healing match when both exist', () => {
    const target = findCrossSourceMergeTarget(
      [
        {
          id: 'rel-same-source',
          title: 'Cut',
          release_date: '2023-01-01',
          spotify_id: 'sp1',
          itunes_id: null,
        },
        {
          id: 'rel-cross-source',
          title: 'Cut',
          release_date: '2024-01-01',
          spotify_id: null,
          itunes_id: null,
        },
      ],
      { title: 'Cut - Single', releaseDate: '2023-09-09' },
      'spotify',
    )

    expect(target?.id).toBe('rel-cross-source')
  })

  it('matches a manual row (no external IDs) with ±1 year difference', () => {
    const manualRow: CrossSourceReleaseRow = {
      id: 'rel-prerelease',
      title: 'Void',
      release_date: '2024-06-01',
      spotify_id: null,
      itunes_id: null,
      discogs_id: null,
    }
    // Spotify release arrives in the next year — still within the ±1 tolerance
    const target = findCrossSourceMergeTarget(
      [manualRow],
      { title: 'Void', releaseDate: '2025-01-15' },
      'spotify',
    )
    expect(target?.id).toBe('rel-prerelease')
  })
})

// ---------------------------------------------------------------------------
// isManualRow
// ---------------------------------------------------------------------------

describe('isManualRow', () => {
  it('returns true when all external IDs are null', () => {
    expect(
      isManualRow({ id: 'r1', title: 'T', release_date: '2024-01-01', spotify_id: null, itunes_id: null, discogs_id: null }),
    ).toBe(true)
  })

  it('returns false when spotify_id is set', () => {
    expect(
      isManualRow({ id: 'r1', title: 'T', release_date: '2024-01-01', spotify_id: 'sp1', itunes_id: null }),
    ).toBe(false)
  })

  it('returns false when itunes_id is set', () => {
    expect(
      isManualRow({ id: 'r1', title: 'T', release_date: '2024-01-01', spotify_id: null, itunes_id: 'it1' }),
    ).toBe(false)
  })

  it('returns false when discogs_id is set', () => {
    expect(
      isManualRow({ id: 'r1', title: 'T', release_date: '2024-01-01', spotify_id: null, itunes_id: null, discogs_id: 'dc1' }),
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// pruneOrphanedDuplicates
// ---------------------------------------------------------------------------

type DbClient = SupabaseClient<Database>

/** Creates a flexible mock Supabase client for pruneOrphanedDuplicates tests. */
function makePruneMockDb(options: {
  /** Data returned by the .select('id, popularity, catalog_number, featured').in() query */
  extraRows?: { id: string; popularity: number | null; catalog_number: string | null; featured: boolean | null }[]
  /** Spy on update calls */
  onUpdate?: (patch: Record<string, unknown>, id: string) => void
  /** Spy on delete calls */
  onDelete?: (ids: string[]) => void
}): DbClient {
  const { extraRows = [], onUpdate, onDelete } = options

  const deletedIds: string[] = []

  // Tracks which `eq` id was used in the last update chain
  let lastUpdatePatch: Record<string, unknown> = {}
  let lastUpdateId = ''

  function makeBuilder(data: unknown) {
    const inIds: string[] = []

    const builder = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockImplementation((patch: Record<string, unknown>) => {
        lastUpdatePatch = patch
        return builder
      }),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation((_col: string, id: string) => {
        lastUpdateId = id
        return builder
      }),
      in: vi.fn().mockImplementation((_col: string, ids: string[]) => {
        inIds.push(...ids)
        return builder
      }),
      then: (resolve: (value: { data: unknown; error: null }) => void) => {
        // Determine what to return based on what was called
        if (builder.delete.mock.calls.length > 0) {
          onDelete?.(inIds)
          deletedIds.push(...inIds)
        } else if (builder.update.mock.calls.length > 0) {
          onUpdate?.(lastUpdatePatch, lastUpdateId)
        }
        return Promise.resolve({ data, error: null }).then(resolve)
      },
      catch: (reject: (reason: unknown) => void) =>
        Promise.resolve({ data, error: null }).catch(reject),
      finally: (cb: () => void) =>
        Promise.resolve({ data, error: null }).finally(cb),
    }
    return builder
  }

  return {
    from: vi.fn().mockImplementation(() => makeBuilder(extraRows)),
  } as unknown as DbClient
}

describe('pruneOrphanedDuplicates', () => {
  it('merges and deletes a manual pre-release row when the Spotify version arrives', async () => {
    // Manual pre-release row (no external IDs)
    const manualRow: CrossSourceReleaseRow = {
      id: 'rel-manual',
      title: 'Void',
      release_date: '2024-06-01',
      spotify_id: null,
      itunes_id: null,
      discogs_id: null,
      barcode: '123456789',
    }
    // Spotify row for the same release
    const spotifyRow: CrossSourceReleaseRow = {
      id: 'rel-spotify',
      title: 'Void',
      release_date: '2024-09-15',
      spotify_id: 'sp-void',
      itunes_id: null,
      discogs_id: null,
      barcode: null,
    }

    const deletedIds: string[] = []
    const updatedPatches: Record<string, unknown>[] = []

    const db = makePruneMockDb({
      extraRows: [
        { id: 'rel-manual', popularity: null, catalog_number: null, featured: false },
        { id: 'rel-spotify', popularity: 72, catalog_number: null, featured: false },
      ],
      onUpdate: (patch) => updatedPatches.push(patch),
      onDelete: (ids) => deletedIds.push(...ids),
    })

    const result = await pruneOrphanedDuplicates(db, 'artist-1', [manualRow, spotifyRow])

    // Spotify row is canonical; manual row is deleted
    expect(deletedIds).toContain('rel-manual')
    // Barcode from manual row was merged into spotify row
    expect(updatedPatches.some((p) => p.barcode === '123456789')).toBe(true)
    expect(result.deleted).toBe(1)
    expect(result.merged).toBe(1)
  })

  it('deletes the lower-popularity Spotify row when two rows share normTitle + year', async () => {
    const highPop: CrossSourceReleaseRow = {
      id: 'rel-cut',
      title: 'Cut',
      release_date: '2023-01-01',
      spotify_id: 'sp-cut',
      itunes_id: null,
    }
    const lowPop: CrossSourceReleaseRow = {
      id: 'rel-cut-single',
      title: 'Cut - Single',
      release_date: '2023-03-01',
      spotify_id: 'sp-cut-single',
      itunes_id: null,
    }

    const deletedIds: string[] = []

    const db = makePruneMockDb({
      extraRows: [
        { id: 'rel-cut', popularity: 80, catalog_number: null, featured: false },
        { id: 'rel-cut-single', popularity: 30, catalog_number: null, featured: false },
      ],
      onDelete: (ids) => deletedIds.push(...ids),
    })

    const result = await pruneOrphanedDuplicates(db, 'artist-1', [highPop, lowPop])

    expect(deletedIds).toContain('rel-cut-single')
    expect(deletedIds).not.toContain('rel-cut')
    expect(result.deleted).toBe(1)
  })

  it('does nothing when there are no duplicate groups', async () => {
    const row1: CrossSourceReleaseRow = {
      id: 'rel-1',
      title: 'Album A',
      release_date: '2023-01-01',
      spotify_id: 'sp-1',
      itunes_id: null,
    }
    const row2: CrossSourceReleaseRow = {
      id: 'rel-2',
      title: 'Album B',
      release_date: '2024-01-01',
      spotify_id: 'sp-2',
      itunes_id: null,
    }

    const deletedIds: string[] = []
    const db = makePruneMockDb({ onDelete: (ids) => deletedIds.push(...ids) })

    const result = await pruneOrphanedDuplicates(db, 'artist-1', [row1, row2])

    expect(deletedIds).toHaveLength(0)
    expect(result.deleted).toBe(0)
    expect(result.merged).toBe(0)
  })

  it('never deletes a featured row', async () => {
    const canonical: CrossSourceReleaseRow = {
      id: 'rel-featured',
      title: 'Cut',
      release_date: '2023-01-01',
      spotify_id: null,
      itunes_id: null,
    }
    const duplicate: CrossSourceReleaseRow = {
      id: 'rel-dup',
      title: 'Cut - Single',
      release_date: '2023-03-01',
      spotify_id: null,
      itunes_id: null,
    }

    const deletedIds: string[] = []

    const db = makePruneMockDb({
      extraRows: [
        { id: 'rel-featured', popularity: null, catalog_number: null, featured: true },
        { id: 'rel-dup', popularity: null, catalog_number: null, featured: false },
      ],
      onDelete: (ids) => deletedIds.push(...ids),
    })

    await pruneOrphanedDuplicates(db, 'artist-1', [canonical, duplicate])

    // 'rel-featured' is canonical by virtue of being the only non-featured candidate
    // 'rel-dup' is deleted since it's not featured
    expect(deletedIds).not.toContain('rel-featured')
  })
})
