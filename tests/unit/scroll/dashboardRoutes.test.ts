import { describe, expect, it } from 'vitest'
import { isAdminListRoute, isDashboardRoute } from '@/lib/scroll/dashboardRoutes'

describe('dashboardRoutes', () => {
  it('detects dashboard routes', () => {
    expect(isDashboardRoute('/admin')).toBe(true)
    expect(isDashboardRoute('/admin/news')).toBe(true)
    expect(isDashboardRoute('/portal/messages')).toBe(true)
    expect(isDashboardRoute('/news')).toBe(false)
  })

  it('detects admin list routes for lockScroll', () => {
    expect(isAdminListRoute('/admin/news')).toBe(true)
    expect(isAdminListRoute('/admin/releases')).toBe(true)
    expect(isAdminListRoute('/admin/artists')).toBe(true)
    expect(isAdminListRoute('/admin/messages')).toBe(false)
    expect(isAdminListRoute('/admin/news/edit/1')).toBe(true)
  })
})