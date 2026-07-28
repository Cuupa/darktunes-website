/**
 * Deep-link routing for notification types (admin/editor + portal).
 */

import { getCmsTabPath } from '@/lib/editor/cmsPaths'
import { isNotificationEventType } from './catalog'
import type { NotificationEventType } from './types'

export function getNotificationHref(
  type: string,
  role: 'admin' | 'editor' | string | undefined,
  opts?: { artistId?: string | null; entityId?: string | null },
): string | null {
  const isEditor = role === 'editor'

  if (!isNotificationEventType(type)) {
    // Legacy / unknown
    return null
  }

  return getKnownNotificationHref(type, isEditor, opts)
}

function getKnownNotificationHref(
  type: NotificationEventType,
  isEditor: boolean,
  opts?: { artistId?: string | null; entityId?: string | null },
): string | null {
  switch (type) {
    case 'landing_page_review':
      return isEditor ? getCmsTabPath('editor', 'fan-page-reviews') : '/admin/fan-page-reviews'
    case 'artist_release_submission':
      return isEditor
        ? getCmsTabPath('editor', 'release-submissions')
        : '/admin/release-submissions'
    case 'artist_video_submission':
      return isEditor ? getCmsTabPath('editor', 'video-submissions') : '/admin/video-submissions'
    case 'press_asset_suggestion':
      return isEditor ? getCmsTabPath('editor', 'assets') : '/admin/assets'
    case 'artist_portal_message':
      return '/admin/messages'
    case 'fan_page_review_decision': {
      const artistId = opts?.artistId
      return artistId ? `/portal/fan-page?artistId=${artistId}` : '/portal/fan-page'
    }
    default:
      return null
  }
}

/** Fallback English summary when i18n is unavailable (tests / server). */
export function getNotificationSummaryFallback(
  type: string,
  entityName?: string | null,
): string {
  switch (type) {
    case 'landing_page_review':
      return entityName ?? 'Fan page awaiting review'
    case 'artist_release_submission':
      return entityName ?? 'Release submission'
    case 'artist_video_submission':
      return entityName ?? 'Video submission'
    case 'press_asset_suggestion':
      return entityName ?? 'Press asset suggestion'
    case 'artist_portal_message':
      return entityName ?? 'New message from artist'
    case 'fan_page_review_decision':
      return entityName ?? 'Fan page review decision'
    default:
      return entityName ?? type
  }
}

export function getNotificationActionLabelFallback(type: string): string {
  switch (type) {
    case 'landing_page_review':
      return 'Review fan page'
    case 'artist_release_submission':
      return 'Review release'
    case 'artist_video_submission':
      return 'Review video'
    case 'press_asset_suggestion':
      return 'Review asset'
    case 'artist_portal_message':
      return 'Open messages'
    case 'fan_page_review_decision':
      return 'Open fan page'
    default:
      return 'Open'
  }
}
