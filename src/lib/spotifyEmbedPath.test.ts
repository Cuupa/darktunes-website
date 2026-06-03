import { describe, it, expect } from 'vitest'
import { getSpotifyEmbedPath } from './spotifyEmbedPath'

const DEFAULT_PLAYLIST = '/playlist/37i9dQZF1DWWqNV5cS50j6'

describe('getSpotifyEmbedPath', () => {
  it('returns the default playlist path for an empty string', () => {
    expect(getSpotifyEmbedPath('')).toBe(DEFAULT_PLAYLIST)
  })

  it('extracts the pathname from a full Spotify track URL', () => {
    expect(getSpotifyEmbedPath('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh')).toBe(
      '/track/4iV5W9uYEdYUVa79Axb7Rh',
    )
  })

  it('extracts the pathname from a full Spotify artist URL', () => {
    expect(getSpotifyEmbedPath('https://open.spotify.com/artist/0TnOYISbd1XYRBk9myaseg')).toBe(
      '/artist/0TnOYISbd1XYRBk9myaseg',
    )
  })

  it('extracts the pathname from a full Spotify album URL', () => {
    expect(getSpotifyEmbedPath('https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3')).toBe(
      '/album/1DFixLWuPkv3KT3TnV35m3',
    )
  })

  it('handles Spotify URLs with query parameters', () => {
    const url = 'https://open.spotify.com/playlist/37i9dQZF1DWWqNV5cS50j6?si=abc123'
    expect(getSpotifyEmbedPath(url)).toBe('/playlist/37i9dQZF1DWWqNV5cS50j6')
  })

  it('converts a Spotify URI (spotify:track:ID) to an embed path', () => {
    expect(getSpotifyEmbedPath('spotify:track:4iV5W9uYEdYUVa79Axb7Rh')).toBe(
      '/track/4iV5W9uYEdYUVa79Axb7Rh',
    )
  })

  it('converts a Spotify URI (spotify:album:ID) to an embed path', () => {
    expect(getSpotifyEmbedPath('spotify:album:1DFixLWuPkv3KT3TnV35m3')).toBe(
      '/album/1DFixLWuPkv3KT3TnV35m3',
    )
  })

  it('wraps a bare 22-character playlist ID in /playlist/', () => {
    expect(getSpotifyEmbedPath('37i9dQZF1DWWqNV5cS50j6')).toBe(
      '/playlist/37i9dQZF1DWWqNV5cS50j6',
    )
  })

  it('falls back to the default playlist for an unrecognisable string', () => {
    expect(getSpotifyEmbedPath('not-a-spotify-thing')).toBe(DEFAULT_PLAYLIST)
  })

  it('handles a subdomain Spotify URL (e.g. embed.spotify.com)', () => {
    expect(getSpotifyEmbedPath('https://embed.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh')).toBe(
      '/track/4iV5W9uYEdYUVa79Axb7Rh',
    )
  })
})
