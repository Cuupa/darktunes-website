import { describe, expect, it } from 'vitest'
import { isAdminNavActive } from './adminNavActive'

function params(tab?: string): URLSearchParams {
  const sp = new URLSearchParams()
  if (tab) sp.set('tab', tab)
  return sp
}

describe('isAdminNavActive', () => {
  it('matches admin dashboard only on exact /admin', () => {
    expect(isAdminNavActive('/admin', '/admin')).toBe(true)
    expect(isAdminNavActive('/admin', '/admin/artists')).toBe(false)
  })

  it('does not treat release-submissions as releases', () => {
    expect(isAdminNavActive('/admin/releases', '/admin/releases')).toBe(true)
    expect(isAdminNavActive('/admin/releases', '/admin/release-submissions')).toBe(false)
    expect(isAdminNavActive('/admin/videos', '/admin/video-submissions')).toBe(false)
  })

  it('matches nested admin paths under a section', () => {
    expect(isAdminNavActive('/admin/messages', '/admin/messages/compose')).toBe(true)
    expect(isAdminNavActive('/admin/news', '/admin/news/new')).toBe(true)
  })

  it('matches editor tab links via search params', () => {
    expect(isAdminNavActive('/editor?tab=news', '/editor', params('news'))).toBe(true)
    expect(isAdminNavActive('/editor?tab=news', '/editor', params('artists'))).toBe(false)
    expect(isAdminNavActive('/editor?tab=news', '/admin/news', params('news'))).toBe(false)
  })

  it('matches editor home only without tab query', () => {
    expect(isAdminNavActive('/editor', '/editor', params())).toBe(true)
    expect(isAdminNavActive('/editor', '/editor', params('artists'))).toBe(false)
  })
})
