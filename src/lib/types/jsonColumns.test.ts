import { describe, expect, it } from 'vitest'
import {
  parseCompactArtist,
  parseCustomLinks,
  parseHeroButton,
  parseJunctionRows,
  parsePlatformLinks,
  toSupabaseJson,
} from './jsonColumns'

describe('parseHeroButton', () => {
  it('returns undefined for nullish input', () => {
    expect(parseHeroButton(null)).toBeUndefined()
    expect(parseHeroButton(undefined)).toBeUndefined()
  })

  it('parses a valid hero button', () => {
    expect(parseHeroButton({ label: 'Listen', action: 'link', href: '/releases' })).toEqual({
      label: 'Listen',
      action: 'link',
      href: '/releases',
    })
  })

  it('returns undefined for invalid action', () => {
    expect(parseHeroButton({ action: 'fly' })).toBeUndefined()
  })
})

describe('parsePlatformLinks', () => {
  it('returns undefined for nullish input', () => {
    expect(parsePlatformLinks(null)).toBeUndefined()
  })

  it('parses string-to-string map', () => {
    expect(parsePlatformLinks({ spotify: 'https://open.spotify.com/track/1' })).toEqual({
      spotify: 'https://open.spotify.com/track/1',
    })
  })

  it('returns undefined when values are not strings', () => {
    expect(parsePlatformLinks({ spotify: 42 })).toBeUndefined()
  })
})

describe('parseCompactArtist', () => {
  it('parses a valid artist join payload', () => {
    expect(parseCompactArtist({ id: 'a1', name: 'Band', slug: 'band' })).toEqual({
      id: 'a1',
      name: 'Band',
      slug: 'band',
    })
  })

  it('returns undefined for invalid payloads', () => {
    expect(parseCompactArtist({ id: 'a1', name: 'Band' })).toBeUndefined()
    expect(parseCompactArtist('nope')).toBeUndefined()
  })
})

describe('parseCustomLinks', () => {
  it('returns an empty array for nullish input', () => {
    expect(parseCustomLinks(null)).toEqual([])
    expect(parseCustomLinks(undefined)).toEqual([])
  })

  it('parses valid link rows', () => {
    expect(parseCustomLinks([{ label: 'Shop', url: 'https://shop.example' }])).toEqual([
      { label: 'Shop', url: 'https://shop.example' },
    ])
  })

  it('returns an empty array when entries are invalid', () => {
    expect(parseCustomLinks([{ label: 'Shop' }])).toEqual([])
    expect(parseCustomLinks('bad')).toEqual([])
  })
})

describe('parseJunctionRows', () => {
  it('skips rows without a parent id or valid artist', () => {
    expect(
      parseJunctionRows(
        [
          { release_id: 'r1', artists: { id: 'a1', name: 'Band', slug: 'band' } },
          { release_id: 42, artists: { id: 'a2', name: 'Other', slug: 'other' } },
          { release_id: 'r2', artists: { id: 'a3', name: 'Broken' } },
        ],
        'release_id',
      ),
    ).toEqual([
      {
        release_id: 'r1',
        artists: { id: 'a1', name: 'Band', slug: 'band' },
      },
    ])
  })

  it('preserves null artists and sort order', () => {
    expect(
      parseJunctionRows(
        [{ news_post_id: 'n1', sort_order: 2, artists: null }],
        'news_post_id',
      ),
    ).toEqual([{ news_post_id: 'n1', sort_order: 2, artists: null }])
  })
})

describe('toSupabaseJson', () => {
  it('strips undefined keys via JSON round-trip', () => {
    expect(toSupabaseJson({ a: 1, b: undefined })).toEqual({ a: 1 })
  })

  it('preserves nested objects', () => {
    expect(toSupabaseJson({ nested: { ok: true } })).toEqual({ nested: { ok: true } })
  })
})