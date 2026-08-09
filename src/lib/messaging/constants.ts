/**
 * Messaging SSOT — list page sizes and attachment limits.
 */

export const MESSAGE_LIST_DEFAULT_LIMIT = 50
export const MESSAGE_LIST_MAX_LIMIT = 100
export const MESSAGE_SEARCH_DEFAULT_LIMIT = 50
export const MESSAGE_ADMIN_INBOX_DEFAULT_LIMIT = 50

/** Max size for a single message attachment (PDF/images/zip). */
export const MESSAGE_ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024

export const MESSAGE_ATTACHMENT_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/csv',
])

export type MessageListOptions = {
  /** 1–MESSAGE_LIST_MAX_LIMIT; defaults to MESSAGE_LIST_DEFAULT_LIMIT */
  limit?: number
  /** Offset for page (0-based) */
  offset?: number
}

export function resolveMessageListLimit(
  requested: number | undefined,
  fallback = MESSAGE_LIST_DEFAULT_LIMIT,
): number {
  const n = requested ?? fallback
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(Math.floor(n), MESSAGE_LIST_MAX_LIMIT)
}

export function resolveMessageListOffset(requested: number | undefined): number {
  if (requested == null || !Number.isFinite(requested) || requested < 0) return 0
  return Math.floor(requested)
}
