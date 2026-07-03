/**
 * Supplementary tests for editorTabPermissions.ts focused on permissionKeyForTab.
 * The primary tests for editorCanAccessTab live in editorTabPermissions.test.ts.
 */
import { describe, expect, it } from 'vitest'
import { permissionKeyForTab, editorCanAccessTab } from './editorTabPermissions'
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

describe('permissionKeyForTab', () => {
  it("maps 'artists' to 'can_manage_artists'", () => {
    expect(permissionKeyForTab('artists')).toBe('can_manage_artists')
  })

  it("maps 'releases' to 'can_manage_releases'", () => {
    expect(permissionKeyForTab('releases')).toBe('can_manage_releases')
  })

  it("maps 'news' to 'can_publish_news'", () => {
    expect(permissionKeyForTab('news')).toBe('can_publish_news')
  })

  it("maps 'videos' to 'can_manage_videos'", () => {
    expect(permissionKeyForTab('videos')).toBe('can_manage_videos')
  })

  it("maps 'assets' to 'can_view_admin_panel'", () => {
    expect(permissionKeyForTab('assets')).toBe('can_view_admin_panel')
  })

  it("returns null for 'events' (ungated tab)", () => {
    expect(permissionKeyForTab('events')).toBeNull()
  })

  it("returns null for 'promo-log' (ungated tab)", () => {
    expect(permissionKeyForTab('promo-log')).toBeNull()
  })

  it("returns null for 'release-submissions' (ungated tab)", () => {
    expect(permissionKeyForTab('release-submissions')).toBeNull()
  })

  it("returns null for 'video-submissions' (ungated tab)", () => {
    expect(permissionKeyForTab('video-submissions')).toBeNull()
  })

  it("returns null for 'genres' (ungated tab)", () => {
    expect(permissionKeyForTab('genres')).toBeNull()
  })
})

describe('editorCanAccessTab – additional cases', () => {
  it('allows events regardless of permissions', () => {
    expect(editorCanAccessTab('events', null)).toBe(true)
  })

  it('allows release-submissions regardless of permissions', () => {
    expect(editorCanAccessTab('release-submissions', null)).toBe(true)
  })

  it('allows fan-page-reviews regardless of permissions', () => {
    expect(editorCanAccessTab('fan-page-reviews', null)).toBe(true)
  })

  it('allows video-submissions regardless of permissions', () => {
    expect(editorCanAccessTab('video-submissions', null)).toBe(true)
  })

  it('allows genres regardless of permissions', () => {
    expect(editorCanAccessTab('genres', null)).toBe(true)
  })

  it('allows artists when can_manage_artists is true', () => {
    expect(editorCanAccessTab('artists', { ...basePermissions, can_manage_artists: true })).toBe(true)
  })

  it('denies artists when can_manage_artists is false', () => {
    expect(editorCanAccessTab('artists', { ...basePermissions, can_manage_artists: false })).toBe(false)
  })

  it('allows releases when can_manage_releases is true', () => {
    expect(editorCanAccessTab('releases', { ...basePermissions, can_manage_releases: true })).toBe(true)
  })

  it('allows news when only can_publish_news is true', () => {
    expect(editorCanAccessTab('news', { ...basePermissions, can_publish_news: true, can_edit_news: false })).toBe(true)
  })

  it('allows news when only can_edit_news is true', () => {
    expect(editorCanAccessTab('news', { ...basePermissions, can_publish_news: false, can_edit_news: true })).toBe(true)
  })

  it('denies news when both can_publish_news and can_edit_news are false', () => {
    expect(editorCanAccessTab('news', { ...basePermissions, can_publish_news: false, can_edit_news: false })).toBe(false)
  })

  it('denies videos when can_manage_videos is false', () => {
    expect(editorCanAccessTab('videos', { ...basePermissions, can_manage_videos: false })).toBe(false)
  })

  it('allows assets when can_view_admin_panel is true', () => {
    expect(editorCanAccessTab('assets', { ...basePermissions, can_view_admin_panel: true })).toBe(true)
  })
})
