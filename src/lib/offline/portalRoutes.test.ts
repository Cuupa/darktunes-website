import { describe, expect, it } from 'vitest'
import { isPortalOfflineRoute } from './portalRoutes'

describe('isPortalOfflineRoute', () => {
  it('allows tour planner and help', () => {
    expect(isPortalOfflineRoute('/portal/tour-planner')).toBe(true)
    expect(isPortalOfflineRoute('/portal/tour-planner/settings')).toBe(true)
    expect(isPortalOfflineRoute('/portal/help')).toBe(true)
    expect(isPortalOfflineRoute('/portal')).toBe(true)
  })

  it('blocks network-only portal sections', () => {
    expect(isPortalOfflineRoute('/portal/events')).toBe(false)
    expect(isPortalOfflineRoute('/portal/analytics')).toBe(false)
  })
})