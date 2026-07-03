import { describe, expect, it } from 'vitest'
import { isValidTab, canSeeTab } from './tabPermissions'
import type { Database } from '@/types/database'

type RolePermissionsRow = Database['public']['Tables']['role_permissions']['Row']

const basePermissions: RolePermissionsRow = {
  role: 'editor',
  can_publish_news: false,
  can_edit_news: false,
  can_manage_artists: false,
  can_manage_releases: false,
  can_manage_videos: false,
  can_view_admin_panel: false,
  updated_at: '2026-01-01T00:00:00.000Z',
  updated_by: null,
}

describe('isValidTab', () => {
  it("returns true for 'artists'", () => {
    expect(isValidTab('artists')).toBe(true)
  })

  it("returns true for 'releases'", () => {
    expect(isValidTab('releases')).toBe(true)
  })

  it("returns true for 'maintenance'", () => {
    expect(isValidTab('maintenance')).toBe(true)
  })

  it("returns true for 'roles'", () => {
    expect(isValidTab('roles')).toBe(true)
  })

  it("returns true for 'news'", () => {
    expect(isValidTab('news')).toBe(true)
  })

  it("returns true for 'promo-log'", () => {
    expect(isValidTab('promo-log')).toBe(true)
  })

  it("returns true for 'submission-form'", () => {
    expect(isValidTab('submission-form')).toBe(true)
  })

  it('returns false for null', () => {
    expect(isValidTab(null)).toBe(false)
  })

  it("returns false for 'unknown'", () => {
    expect(isValidTab('unknown')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isValidTab('')).toBe(false)
  })
})

describe('canSeeTab', () => {
  it('admin sees all tabs including roles and adminOnly ones', () => {
    const opts = { isAdmin: true, isEditor: false, contentOnly: false, permissions: null }
    expect(canSeeTab('artists', opts)).toBe(true)
    expect(canSeeTab('maintenance', opts)).toBe(true)
    expect(canSeeTab('assets', opts)).toBe(true)
    expect(canSeeTab('press', opts)).toBe(true)
    expect(canSeeTab('roles', opts)).toBe(true)
  })

  it('editor with can_manage_artists sees artists tab', () => {
    const opts = {
      isAdmin: false,
      isEditor: true,
      contentOnly: false,
      permissions: { ...basePermissions, can_manage_artists: true },
    }
    expect(canSeeTab('artists', opts)).toBe(true)
  })

  it('editor without can_manage_artists does NOT see artists tab', () => {
    const opts = {
      isAdmin: false,
      isEditor: true,
      contentOnly: false,
      permissions: { ...basePermissions, can_manage_artists: false },
    }
    expect(canSeeTab('artists', opts)).toBe(false)
  })

  it('editor always sees events (ungated tab)', () => {
    const opts = {
      isAdmin: false,
      isEditor: true,
      contentOnly: false,
      permissions: null,
    }
    expect(canSeeTab('events', opts)).toBe(true)
  })

  it('editor always sees release-submissions (ungated tab)', () => {
    const opts = {
      isAdmin: false,
      isEditor: true,
      contentOnly: false,
      permissions: null,
    }
    expect(canSeeTab('release-submissions', opts)).toBe(true)
  })

  it('contentOnly user sees non-adminOnly tabs', () => {
    const opts = { isAdmin: false, isEditor: false, contentOnly: true, permissions: null }
    expect(canSeeTab('releases', opts)).toBe(true)
    expect(canSeeTab('news', opts)).toBe(true)
    expect(canSeeTab('events', opts)).toBe(true)
  })

  it('contentOnly user does NOT see adminOnly tabs', () => {
    const opts = { isAdmin: false, isEditor: false, contentOnly: true, permissions: null }
    expect(canSeeTab('maintenance', opts)).toBe(false)
    expect(canSeeTab('assets', opts)).toBe(false)
    expect(canSeeTab('press', opts)).toBe(false)
    expect(canSeeTab('roles', opts)).toBe(false)
  })

  it('non-admin, non-editor, non-contentOnly sees nothing', () => {
    const opts = { isAdmin: false, isEditor: false, contentOnly: false, permissions: null }
    expect(canSeeTab('artists', opts)).toBe(false)
    expect(canSeeTab('releases', opts)).toBe(false)
    expect(canSeeTab('events', opts)).toBe(false)
  })

  it('editor with can_manage_releases sees releases tab', () => {
    const opts = {
      isAdmin: false,
      isEditor: true,
      contentOnly: false,
      permissions: { ...basePermissions, can_manage_releases: true },
    }
    expect(canSeeTab('releases', opts)).toBe(true)
  })

  it('editor with can_manage_videos: false does not see videos', () => {
    const opts = {
      isAdmin: false,
      isEditor: true,
      contentOnly: false,
      permissions: { ...basePermissions, can_manage_videos: false },
    }
    expect(canSeeTab('videos', opts)).toBe(false)
  })

  it('editor does NOT see adminOnly tab even with all permissions', () => {
    const allPermissions: RolePermissionsRow = {
      ...basePermissions,
      can_manage_artists: true,
      can_manage_releases: true,
      can_publish_news: true,
      can_edit_news: true,
      can_manage_videos: true,
      can_view_admin_panel: true,
    }
    const opts = { isAdmin: false, isEditor: true, contentOnly: false, permissions: allPermissions }
    expect(canSeeTab('maintenance', opts)).toBe(false)
    expect(canSeeTab('roles', opts)).toBe(false)
  })
})
