/**
 * Shared types for the unified notification platform.
 */

export type NotificationAudience = 'staff' | 'artist'

/** Catalog event types. Prefer these over free-text inserts. */
export type NotificationEventType =
  | 'artist_release_submission'
  | 'artist_video_submission'
  | 'landing_page_review'
  | 'press_asset_suggestion'
  | 'artist_portal_message'
  | 'fan_page_review_decision'

export type StaffRole = 'admin' | 'editor'

export interface NotificationCatalogEntry {
  audience: NotificationAudience
  /** Staff roles that receive the event (staff audience only). */
  roles?: readonly StaffRole[]
  defaultEntityType: string
  /** i18n key under admin.notifications.types.* or portal.notifications.types.* */
  summaryKey: string
  actionKey: string
}

export interface EmitNotificationInput {
  type: NotificationEventType
  entityType?: string
  entityId: string
  entityName?: string | null
  senderId?: string | null
  /** Required for artist-audience events; optional context for staff. */
  artistId?: string | null
  payload?: Record<string, unknown>
  /**
   * When set, unique per (user_id, dedupe_key). Retries with the same key
   * do not create a second row.
   */
  dedupeKey?: string | null
  /** Override resolved recipients (e.g. single assignee). */
  userIds?: string[]
}

export interface EmitNotificationResult {
  inserted: number
  userIds: string[]
}
