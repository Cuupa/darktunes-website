import { describe, expect, it } from 'vitest'
import { editorCanAccessTab } from './editorTabPermissions'
import type { Database } from '@/types/database'

type RolePermissionsRow = Database['public']['Tables']['role_permissions']['Row']

const editorDefaults: RolePermissionsRow = {
  role: 'editor',
  can_publish_news: true,
  can_edit_news: true,
  can_manage_artists: false,
  can_manage_releases: true,
  can_manage_videos: true,
  can_view_admin_panel: true,
  updated_at: '2026-01-01T00:00:00.000Z',
  updated_by: null,
}

describe('editorCanAccessTab', () => {
  it('hides artists when can_manage_artists is false', () => {
    expect(editorCanAccessTab('artists', editorDefaults)).toBe(false)
  })

  it('shows releases and promo-log for default editor permissions', () => {
    expect(editorCanAccessTab('releases', editorDefaults)).toBe(true)
    expect(editorCanAccessTab('promo-log', editorDefaults)).toBe(true)
  })

  it('requires permissions row when tab is gated', () => {
    expect(editorCanAccessTab('artists', null)).toBe(false)
  })
})