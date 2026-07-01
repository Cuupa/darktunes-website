import type { DashboardNotification } from '@/types'
import { getCmsTabPath } from '@/lib/editor/cmsPaths'

export function getDashboardNotificationHref(
  notification: Pick<DashboardNotification, 'type'>,
  role: 'admin' | 'editor' | string | undefined,
): string | null {
  const isEditor = role === 'editor'

  switch (notification.type) {
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
    default:
      return null
  }
}

export function getDashboardNotificationSummary(
  notification: Pick<DashboardNotification, 'type' | 'entityName' | 'entityType'>,
): string {
  switch (notification.type) {
    case 'landing_page_review':
      return notification.entityName ?? 'Fan page awaiting review'
    case 'artist_release_submission':
      return notification.entityName ?? 'Release submission'
    case 'artist_video_submission':
      return notification.entityName ?? 'Video submission'
    case 'press_asset_suggestion':
      return notification.entityName ?? 'Press asset suggestion'
    case 'artist_portal_message':
      return notification.entityName ?? 'New message from artist'
    default:
      return notification.entityName ?? notification.entityType
  }
}

export function getDashboardNotificationActionLabel(type: string): string {
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
    default:
      return 'Open'
  }
}