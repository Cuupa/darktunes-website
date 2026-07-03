import { describe, expect, it } from 'vitest'
import { resolveActiveNavHref } from './resolveActiveNavHref'

describe('resolveActiveNavHref', () => {
  it('exact match on /portal', () => {
    expect(resolveActiveNavHref('/portal', ['/portal'])).toBe('/portal')
  })

  it('returns the longer prefix when two hrefs both match', () => {
    expect(resolveActiveNavHref('/portal/profile', ['/portal', '/portal/profile'])).toBe('/portal/profile')
  })

  it('prefix-matches a sub-path to its parent href', () => {
    expect(resolveActiveNavHref('/portal/profile/edit', ['/portal', '/portal/profile'])).toBe(
      '/portal/profile',
    )
  })

  it('prefix-matches a deep sub-path', () => {
    expect(
      resolveActiveNavHref('/portal/epk-builder/canvas', ['/portal', '/portal/epk-builder']),
    ).toBe('/portal/epk-builder')
  })

  it('returns null when no href matches', () => {
    expect(
      resolveActiveNavHref('/portal/unknown', ['/portal', '/portal/profile']),
    ).toBeNull()
  })

  it('/portal does NOT prefix-match /portal/profile', () => {
    expect(resolveActiveNavHref('/portal/profile', ['/portal'])).toBeNull()
  })

  it('longest prefix wins when multiple prefixes match', () => {
    expect(
      resolveActiveNavHref('/portal/releases/submissions', [
        '/portal/releases',
        '/portal/releases/submissions',
      ]),
    ).toBe('/portal/releases/submissions')
  })

  it('returns exact match when pathname equals non-root href', () => {
    expect(resolveActiveNavHref('/portal/profile', ['/portal/profile', '/portal/epk-builder'])).toBe(
      '/portal/profile',
    )
  })

  it('does not falsely match a href that is just a prefix of another word', () => {
    // /portal/releasesX should NOT match /portal/releases
    expect(resolveActiveNavHref('/portal/releasesX', ['/portal/releases'])).toBeNull()
  })

  it('returns null for empty hrefs array', () => {
    expect(resolveActiveNavHref('/portal/profile', [])).toBeNull()
  })
})
