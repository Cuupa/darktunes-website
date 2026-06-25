import { describe, expect, it } from 'vitest'
import {
  getCmsArtistsPath,
  getCmsHomePath,
  getCmsNewsListPath,
  getCmsPromoLogPath,
  getCmsTabPath,
} from './cmsPaths'

describe('cmsPaths', () => {
  it('returns editor-specific dashboard paths', () => {
    expect(getCmsHomePath('editor')).toBe('/editor')
    expect(getCmsTabPath('editor', 'news')).toBe('/editor?tab=news')
    expect(getCmsArtistsPath('editor')).toBe('/editor?tab=artists')
    expect(getCmsNewsListPath('editor')).toBe('/editor?tab=news')
    expect(getCmsPromoLogPath('editor')).toBe('/editor?tab=promo-log')
  })

  it('returns admin paths for admins', () => {
    expect(getCmsHomePath('admin')).toBe('/admin')
    expect(getCmsNewsListPath('admin')).toBe('/admin/news')
    expect(getCmsPromoLogPath('admin')).toBe('/admin/promo-log')
  })
})