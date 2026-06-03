import { describe, it, expect } from 'vitest'
import {
  escapeRegExp,
  createArtistMatcher,
  findMatchingArtist,
  resolveVideoArtist,
  type ArtistMatcher,
} from './videoAttribution'

// ---------------------------------------------------------------------------
// escapeRegExp
// ---------------------------------------------------------------------------

describe('escapeRegExp', () => {
  it('returns plain strings unchanged', () => {
    expect(escapeRegExp('BLACKBOOK')).toBe('BLACKBOOK')
  })

  it('escapes all RegExp special characters', () => {
    expect(escapeRegExp('A.B*C+D?E^F$G{H}I(J)K[L]M\\N|O')).toBe(
      'A\\.B\\*C\\+D\\?E\\^F\\$G\\{H\\}I\\(J\\)K\\[L\\]M\\\\N\\|O',
    )
  })

  it('escapes dots so "A.B" does not match "AXB"', () => {
    const escaped = escapeRegExp('A.B')
    const re = new RegExp(escaped)
    expect(re.test('A.B')).toBe(true)
    expect(re.test('AXB')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// createArtistMatcher
// ---------------------------------------------------------------------------

describe('createArtistMatcher', () => {
  it('returns null for an empty name', () => {
    expect(createArtistMatcher({ id: 'x', name: '' })).toBeNull()
  })

  it('returns null for a whitespace-only name', () => {
    expect(createArtistMatcher({ id: 'x', name: '   ' })).toBeNull()
  })

  it('returns a matcher for a valid artist name', () => {
    const matcher = createArtistMatcher({ id: 'a1', name: 'BLACKBOOK' })
    expect(matcher).not.toBeNull()
    expect(matcher?.id).toBe('a1')
    expect(matcher?.name).toBe('BLACKBOOK')
    expect(matcher?.pattern).toBeInstanceOf(RegExp)
  })

  it('creates a case-insensitive pattern', () => {
    const m = createArtistMatcher({ id: 'a1', name: 'BLACKBOOK' })!
    expect(m.pattern.test('blackbook – Monster')).toBe(true)
    expect(m.pattern.test('BLACKBOOK – Monster')).toBe(true)
    expect(m.pattern.test('Blackbook – Monster')).toBe(true)
  })

  it('does not match a substring of a larger word', () => {
    const m = createArtistMatcher({ id: 'a1', name: 'ARIA' })!
    // "ARIA" must not match "ARIANA"
    expect(m.pattern.test('ARIANA – Song')).toBe(false)
    expect(m.pattern.test('ARIA – Song')).toBe(true)
  })

  it('matches at the start and end of the title', () => {
    const m = createArtistMatcher({ id: 'a1', name: 'NIGHTFALL' })!
    expect(m.pattern.test('NIGHTFALL')).toBe(true)
    expect(m.pattern.test('Concert by NIGHTFALL')).toBe(true)
  })

  it('escapes special characters in artist names', () => {
    const m = createArtistMatcher({ id: 'a1', name: 'A.B.' })!
    // "A.B." should match literally, not "AXB" (dot-as-wildcard)
    expect(m.pattern.test('A.B. – Live')).toBe(true)
    expect(m.pattern.test('AXB. – Live')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// findMatchingArtist
// ---------------------------------------------------------------------------

describe('findMatchingArtist', () => {
  const matchers: ArtistMatcher[] = [
    createArtistMatcher({ id: 'a1', name: 'BLACKBOOK' })!,
    createArtistMatcher({ id: 'a2', name: 'Nocturna' })!,
    createArtistMatcher({ id: 'a3', name: 'ARIA' })!,
  ]

  it('returns null when no artist matches', () => {
    expect(findMatchingArtist('Unknown Band – Debut Single', matchers)).toBeNull()
  })

  it('returns the matched artist when name appears in title', () => {
    const result = findMatchingArtist('BLACKBOOK – Monsters (Official Video)', matchers)
    expect(result?.id).toBe('a1')
    expect(result?.name).toBe('BLACKBOOK')
  })

  it('is case-insensitive', () => {
    const result = findMatchingArtist('nocturna – Live Session', matchers)
    expect(result?.id).toBe('a2')
  })

  it('returns the first match when multiple artists could match', () => {
    // Contrived: both ARIA and BLACKBOOK in title; first in array wins
    const result = findMatchingArtist('BLACKBOOK feat. ARIA', matchers)
    expect(result?.id).toBe('a1')
  })

  it('does not match partial words', () => {
    // "ARIA" should not match "ARIANA"
    expect(findMatchingArtist('ARIANA – Hit Song', matchers)).toBeNull()
  })

  it('returns null when matchers list is empty', () => {
    expect(findMatchingArtist('BLACKBOOK – Song', [])).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// resolveVideoArtist
// ---------------------------------------------------------------------------

describe('resolveVideoArtist', () => {
  const CHANNEL_TITLE = 'darkTunes Music Group'
  const matchers: ArtistMatcher[] = [
    createArtistMatcher({ id: 'a1', name: 'BLACKBOOK' })!,
    createArtistMatcher({ id: 'a2', name: 'Nocturna' })!,
  ]

  it('uses the matched artist name and id when a match is found', () => {
    const result = resolveVideoArtist(
      'BLACKBOOK – Monsters (Official Video)',
      CHANNEL_TITLE,
      matchers,
    )
    expect(result.artistId).toBe('a1')
    expect(result.artistName).toBe('BLACKBOOK')
  })

  it('falls back to channelTitle when no artist matches', () => {
    const result = resolveVideoArtist('Label Compilation Vol. 1', CHANNEL_TITLE, matchers)
    expect(result.artistId).toBeNull()
    expect(result.artistName).toBe(CHANNEL_TITLE)
  })

  it('sets artistId to null and uses channelTitle with empty matchers', () => {
    const result = resolveVideoArtist('BLACKBOOK – Song', CHANNEL_TITLE, [])
    expect(result.artistId).toBeNull()
    expect(result.artistName).toBe(CHANNEL_TITLE)
  })

  it('preserves the exact casing of the artist name from the DB', () => {
    // Even though the title has lower-case "nocturna", the result should use
    // the DB artist name "Nocturna" (title-cased).
    const result = resolveVideoArtist('nocturna – Dark Sky', CHANNEL_TITLE, matchers)
    expect(result.artistName).toBe('Nocturna')
  })
})
