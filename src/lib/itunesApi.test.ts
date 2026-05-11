import { describe, expect, it, vi } from 'vitest'
import { searchItunesArtist } from './itunesApi'

describe('searchItunesArtist', () => {
  it('resolves artist ID first, then fetches collections and upgrades artwork URLs', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCount: 1,
          results: [{ artistId: 42, artistName: 'Dark Artist' }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          resultCount: 2,
          results: [
            {
              wrapperType: 'artist',
              artistId: 42,
              artistName: 'Dark Artist',
            },
            {
              wrapperType: 'collection',
              collectionId: 99,
              collectionName: 'Black Sun',
              artistId: 42,
              artistName: 'Dark Artist',
              artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music/abc/100x100bb.jpg',
              releaseDate: '2026-01-01T00:00:00Z',
              collectionType: 'Album',
              trackCount: 10,
              primaryGenreName: 'Industrial',
              collectionViewUrl: 'https://music.apple.com/album/99',
            },
          ],
        }),
      } as Response)

    const releases = await searchItunesArtist('Dark Artist', fetchFn)

    expect(fetchFn).toHaveBeenNthCalledWith(
      1,
      'https://itunes.apple.com/search?term=Dark%20Artist&entity=musicArtist&attribute=artistTerm&limit=5',
    )
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      'https://itunes.apple.com/lookup?id=42&entity=album&limit=200',
    )
    expect(releases).toHaveLength(1)
    expect(releases[0].artworkUrl100).toContain('3000x3000bb.jpg')
  })

  it('returns empty array when no exact artist match is found in stage 1', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        resultCount: 1,
        results: [{ artistId: 99, artistName: 'Other Artist' }],
      }),
    } as Response)

    const releases = await searchItunesArtist('Dark Artist', fetchFn)

    expect(releases).toEqual([])
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
})
