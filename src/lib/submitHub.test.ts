import { describe, it, expect } from 'vitest'
import { resolveSubmitHubUrl, DEFAULT_SUBMIT_HUB_URL } from './submitHub'

describe('resolveSubmitHubUrl', () => {
  it('falls back to the default when undefined', () => {
    expect(resolveSubmitHubUrl(undefined)).toBe(DEFAULT_SUBMIT_HUB_URL)
  })

  it('falls back to the default when null', () => {
    expect(resolveSubmitHubUrl(null)).toBe(DEFAULT_SUBMIT_HUB_URL)
  })

  it('falls back to the default for an empty or whitespace-only string', () => {
    expect(resolveSubmitHubUrl('')).toBe(DEFAULT_SUBMIT_HUB_URL)
    expect(resolveSubmitHubUrl('   ')).toBe(DEFAULT_SUBMIT_HUB_URL)
  })

  it('prepends https:// to a bare domain', () => {
    expect(resolveSubmitHubUrl('sbmt.to/darktunes-music-group')).toBe(
      'https://sbmt.to/darktunes-music-group',
    )
  })

  it('leaves an already-absolute https URL untouched', () => {
    expect(resolveSubmitHubUrl('https://www.submithub.com/playlister/foo')).toBe(
      'https://www.submithub.com/playlister/foo',
    )
  })

  it('leaves an already-absolute http URL untouched', () => {
    expect(resolveSubmitHubUrl('http://example.com/foo')).toBe('http://example.com/foo')
  })

  it('trims surrounding whitespace before checking the scheme', () => {
    expect(resolveSubmitHubUrl('  sbmt.to/darktunes-music-group  ')).toBe(
      'https://sbmt.to/darktunes-music-group',
    )
  })
})
