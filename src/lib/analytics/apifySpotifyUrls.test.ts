import { describe, expect, it } from 'vitest'
import {
  buildSpotifyOpenUrl,
  parseSpotifyId,
  resolveSpotifyEntityUrl,
} from './apifySpotifyUrls'

describe('parseSpotifyId', () => {
  const artistId = '7Ln80lUS6He07XvHI8qqHH'
  const albumId = '1XkGORuUX2QGOEIL4EbJKm'

  it('accepts bare 22-char ids', () => {
    expect(parseSpotifyId('artist', artistId)).toBe(artistId)
    expect(parseSpotifyId('album', albumId)).toBe(albumId)
  })

  it('parses open.spotify.com paths including intl prefixes', () => {
    expect(parseSpotifyId('artist', `https://open.spotify.com/artist/${artistId}`)).toBe(artistId)
    expect(
      parseSpotifyId('artist', `https://open.spotify.com/intl-de/artist/${artistId}?si=abc`),
    ).toBe(artistId)
    expect(parseSpotifyId('album', `https://open.spotify.com/album/${albumId}`)).toBe(albumId)
  })

  it('parses spotify: URIs', () => {
    expect(parseSpotifyId('artist', `spotify:artist:${artistId}`)).toBe(artistId)
    expect(parseSpotifyId('album', `spotify:album:${albumId}`)).toBe(albumId)
  })

  it('rejects wrong kind or garbage', () => {
    expect(parseSpotifyId('artist', `https://open.spotify.com/album/${albumId}`)).toBeNull()
    expect(parseSpotifyId('artist', 'not-a-url')).toBeNull()
    expect(parseSpotifyId('artist', '')).toBeNull()
    expect(parseSpotifyId('artist', null)).toBeNull()
  })
})

describe('resolveSpotifyEntityUrl', () => {
  const artistId = '7Ln80lUS6He07XvHI8qqHH'

  it('prefers spotify_id over url', () => {
    const resolved = resolveSpotifyEntityUrl(
      'artist',
      artistId,
      'https://open.spotify.com/artist/0000000000000000000000',
    )
    expect(resolved).toEqual({
      kind: 'artist',
      id: artistId,
      url: buildSpotifyOpenUrl('artist', artistId),
    })
  })

  it('falls back to url when id missing', () => {
    const resolved = resolveSpotifyEntityUrl(
      'artist',
      null,
      `https://open.spotify.com/artist/${artistId}`,
    )
    expect(resolved?.id).toBe(artistId)
  })

  it('returns null when neither resolves', () => {
    expect(resolveSpotifyEntityUrl('artist', null, null)).toBeNull()
    expect(resolveSpotifyEntityUrl('artist', 'bad', 'also-bad')).toBeNull()
  })
})
