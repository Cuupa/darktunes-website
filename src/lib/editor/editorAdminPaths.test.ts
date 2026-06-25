import { describe, expect, it } from 'vitest'
import { isEditorAllowedAdminPath } from './editorAdminPaths'

describe('isEditorAllowedAdminPath', () => {
  it('allows news editor routes', () => {
    expect(isEditorAllowedAdminPath('/admin/news')).toBe(true)
    expect(isEditorAllowedAdminPath('/admin/news/new')).toBe(true)
    expect(isEditorAllowedAdminPath('/admin/news/abc-123')).toBe(true)
  })

  it('allows artist edit and promo log routes', () => {
    expect(isEditorAllowedAdminPath('/admin/artists/artist-1/edit')).toBe(true)
    expect(isEditorAllowedAdminPath('/admin/promo-log')).toBe(true)
  })

  it('blocks general admin routes', () => {
    expect(isEditorAllowedAdminPath('/admin')).toBe(false)
    expect(isEditorAllowedAdminPath('/admin/users')).toBe(false)
    expect(isEditorAllowedAdminPath('/admin/artists')).toBe(false)
    expect(isEditorAllowedAdminPath('/admin/accounting')).toBe(false)
  })
})