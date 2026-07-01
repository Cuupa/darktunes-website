import { describe, expect, it } from 'vitest'
import {
  getDashboardNotificationActionLabel,
  getDashboardNotificationHref,
  getDashboardNotificationSummary,
} from '@/lib/admin/dashboardNotificationRouting'

describe('dashboardNotificationRouting', () => {
  it('routes fan page review notifications to the review queue', () => {
    expect(
      getDashboardNotificationHref({ type: 'landing_page_review' }, 'admin'),
    ).toBe('/admin/fan-page-reviews')
    expect(
      getDashboardNotificationHref({ type: 'landing_page_review' }, 'editor'),
    ).toBe('/editor?tab=fan-page-reviews')
  })

  it('routes artist portal messages to the admin inbox', () => {
    expect(
      getDashboardNotificationHref({ type: 'artist_portal_message' }, 'admin'),
    ).toBe('/admin/messages')
    expect(
      getDashboardNotificationHref({ type: 'artist_portal_message' }, 'editor'),
    ).toBe('/admin/messages')
  })

  it('summarizes known notification types', () => {
    expect(
      getDashboardNotificationSummary({
        type: 'landing_page_review',
        entityName: 'Neuroklast Fan Page',
        entityType: 'artist',
      }),
    ).toBe('Neuroklast Fan Page')
    expect(
      getDashboardNotificationSummary({
        type: 'artist_portal_message',
        entityName: 'Band: Tour dates',
        entityType: 'portal_message',
      }),
    ).toBe('Band: Tour dates')
    expect(getDashboardNotificationActionLabel('artist_portal_message')).toBe('Open messages')
  })
})