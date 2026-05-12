import { describe, it, expect } from 'vitest'
import {
  extractSpotifyArtistId,
  parseSpotifyUrl,
  extractYouTubeChannelId,
  extractYouTubeVideoId,
  extractDiscogsArtistId,
  extractAppleMusicArtistId,
  extractDeezerArtistId,
} from './platformUrlParser'

describe('extractSpotifyArtistId', () => {
  it('handles standard artist URL', () => {
    expect(extractSpotifyArtistId('https://open.spotify.com/artist/1Cs0zKBU1kc0i8ypK3B9ai')).toBe(
      '1Cs0zKBU1kc0i8ypK3B9ai',
    )
  })

  it('handles international intl-de artist URL', () => {
    expect(
      extractSpotifyArtistId('https://open.spotify.com/intl-de/artist/1Cs0zKBU1kc0i8ypK3B9ai'),
    ).toBe('1Cs0zKBU1kc0i8ypK3B9ai')
  })

  it('handles spotify:artist: URI', () => {
    expect(extractSpotifyArtistId('spotify:artist:1Cs0zKBU1kc0i8ypK3B9ai')).toBe(
      '1Cs0zKBU1kc0i8ypK3B9ai',
    )
  })

  it('handles bare ID', () => {
    expect(extractSpotifyArtistId('1Cs0zKBU1kc0i8ypK3B9ai')).toBe('1Cs0zKBU1kc0i8ypK3B9ai')
  })

  it('returns null for empty input', () => {
    expect(extractSpotifyArtistId('')).toBeNull()
  })

  it('returns null for non-spotify URL', () => {
    expect(extractSpotifyArtistId('https://example.com/artist/123')).toBeNull()
  })
})

describe('parseSpotifyUrl', () => {
  it('parses artist URL', () => {
    const result = parseSpotifyUrl('https://open.spotify.com/artist/abc')
    expect(result).toEqual({ type: 'artist', id: 'abc' })
  })

  it('parses album URL', () => {
    const result = parseSpotifyUrl('https://open.spotify.com/album/xyz')
    expect(result).toEqual({ type: 'album', id: 'xyz' })
  })

  it('parses intl URL', () => {
    const result = parseSpotifyUrl('https://open.spotify.com/intl-de/album/xyz')
    expect(result).toEqual({ type: 'album', id: 'xyz' })
  })
})

describe('extractYouTubeVideoId', () => {
  it('handles watch URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    )
  })

  it('handles youtu.be short URL', () => {
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('handles shorts URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    )
  })

  it('handles bare 11-char ID', () => {
    expect(extractYouTubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('returns null for channel URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/channel/UCxxx')).toBeNull()
  })
})

describe('extractYouTubeChannelId', () => {
  it('handles /channel/UCxxx URL', () => {
    expect(
      extractYouTubeChannelId('https://www.youtube.com/channel/UC1234567890abcdefghijkl'),
    ).toBe('UC1234567890abcdefghijkl')
  })

  it('handles @handle URL', () => {
    expect(extractYouTubeChannelId('https://www.youtube.com/@darktunesmusic')).toBe(
      '@darktunesmusic',
    )
  })

  it('handles bare UC... ID', () => {
    expect(extractYouTubeChannelId('UC1234567890abcdefghijkl')).toBe('UC1234567890abcdefghijkl')
  })
})

describe('extractDiscogsArtistId', () => {
  it('handles standard URL', () => {
    expect(extractDiscogsArtistId('https://www.discogs.com/artist/123456')).toBe('123456')
  })

  it('handles regional URL', () => {
    expect(extractDiscogsArtistId('https://www.discogs.com/de/artist/123456')).toBe('123456')
  })

  it('handles URL with name slug', () => {
    expect(extractDiscogsArtistId('https://www.discogs.com/artist/123456-Artist-Name')).toBe(
      '123456',
    )
  })

  it('handles bare numeric ID', () => {
    expect(extractDiscogsArtistId('123456')).toBe('123456')
  })

  it('returns null for non-discogs URL', () => {
    expect(extractDiscogsArtistId('https://example.com/artist/123')).toBeNull()
  })
})

describe('extractAppleMusicArtistId', () => {
  it('handles Apple Music artist URL', () => {
    expect(
      extractAppleMusicArtistId('https://music.apple.com/de/artist/artist-name/123456789'),
    ).toBe('123456789')
  })

  it('handles iTunes URL with id prefix', () => {
    expect(
      extractAppleMusicArtistId('https://itunes.apple.com/de/artist/name/id123456789'),
    ).toBe('123456789')
  })

  it('handles bare numeric ID', () => {
    expect(extractAppleMusicArtistId('123456789')).toBe('123456789')
  })
})

describe('extractDeezerArtistId', () => {
  it('handles standard Deezer artist URL', () => {
    expect(extractDeezerArtistId('https://www.deezer.com/artist/12345')).toBe('12345')
  })

  it('handles regional Deezer URL', () => {
    expect(extractDeezerArtistId('https://www.deezer.com/de/artist/12345')).toBe('12345')
  })

  it('handles bare numeric ID', () => {
    expect(extractDeezerArtistId('12345')).toBe('12345')
  })
})
