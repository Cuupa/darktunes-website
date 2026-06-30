import type { EditorNotification } from '@/types'
import { getCmsTabPath } from '@/lib/editor/cmsPaths'

export function getEditorNotificationHref(
  notification: Pick<EditorNotification, 'type'>,
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
    default:
      return null
  }
}

export function getEditorNotificationSummary(
  notification: Pick<EditorNotification, 'type' | 'entityName' | 'entityType'>,
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
    default:
      return notification.entityName ?? notification.entityType
  }
}

export function getEditorNotificationActionLabel(type: string): string {
  switch (type) {
    case 'landing_page_review':
      return 'Review fan page'
    case 'artist_release_submission':
      return 'Review release'
    case 'artist_video_submission':
      return 'Review video'
    case 'press_asset_suggestion':
      return 'Review asset'
    default:
      return 'Open'
  }
}