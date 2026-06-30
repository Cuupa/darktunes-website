import { describe, expect, it } from 'vitest'
import {
  getEditorNotificationActionLabel,
  getEditorNotificationHref,
  getEditorNotificationSummary,
} from '@/lib/admin/editorNotificationRouting'

describe('editorNotificationRouting', () => {
  it('routes fan page review notifications to the review queue', () => {
    expect(
      getEditorNotificationHref({ type: 'landing_page_review' }, 'admin'),
    ).toBe('/admin/fan-page-reviews')
    expect(
      getEditorNotificationHref({ type: 'landing_page_review' }, 'editor'),
    ).toBe('/editor?tab=fan-page-reviews')
  })

  it('summarizes known notification types', () => {
    expect(
      getEditorNotificationSummary({
        type: 'landing_page_review',
        entityName: 'Neuroklast Fan Page',
        entityType: 'artist',
      }),
    ).toBe('Neuroklast Fan Page')
    expect(getEditorNotificationActionLabel('landing_page_review')).toBe('Review fan page')
  })
})