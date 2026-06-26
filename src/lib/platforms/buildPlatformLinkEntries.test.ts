import { describe, it, expect } from 'vitest'
import { buildPlatformLinkEntries } from './buildPlatformLinkEntries'

describe('buildPlatformLinkEntries', () => {
  it('merges Odesli platform links with individual URL fallbacks', () => {
    const entries = buildPlatformLinkEntries({
      platformLinks: {
        tidal: 'https://tidal.com/album/1',
        deezer: 'https://deezer.com/album/2',
      },
      spotifyUrl: 'https://open.spotify.com/album/sp',
      appleMusicUrl: 'https://music.apple.com/album/am',
    })

    expect(entries.map((e) => e.key)).toEqual([
      'spotify',
      'appleMusic',
      'deezer',
      'tidal',
    ])
  })

  it('excludes song.link hub keys from display', () => {
    const entries = buildPlatformLinkEntries({
      platformLinks: {
        spotify: 'https://open.spotify.com/album/sp',
        smartlink: 'https://song.link/s/abc',
        songlink: 'https://song.link/s/def',
      },
    })

    expect(entries).toEqual([
      { key: 'spotify', url: 'https://open.spotify.com/album/sp' },
    ])
  })

  it('falls back to individual URLs when platform_links is empty', () => {
    const entries = buildPlatformLinkEntries({
      spotifyUrl: 'https://open.spotify.com/album/sp',
      appleMusicUrl: 'https://music.apple.com/album/am',
    })

    expect(entries).toEqual([
      { key: 'spotify', url: 'https://open.spotify.com/album/sp' },
      { key: 'appleMusic', url: 'https://music.apple.com/album/am' },
    ])
  })
})