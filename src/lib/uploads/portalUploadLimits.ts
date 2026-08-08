/**
 * Shared hard limits for portal uploads and related abuse guards (SSOT).
 * Route handlers must import constants from here — no local MAX_BYTES copies.
 */

export const PORTAL_PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const PORTAL_RIDER_MAX_BYTES = 10 * 1024 * 1024
export const PORTAL_ASSET_MAX_BYTES = 20 * 1024 * 1024
export const PORTAL_RELEASE_COVER_MAX_BYTES = 5 * 1024 * 1024
export const PORTAL_FONT_MAX_BYTES = 5 * 1024 * 1024
export const PORTAL_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024
export const PORTAL_TECH_DOC_MAX_BYTES = 10 * 1024 * 1024

export const PORTAL_PHOTO_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

export const PORTAL_COVER_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

export const PORTAL_ASSET_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/zip',
])

/** Rate-limit defaults: max requests per user+IP window. */
export const PORTAL_UPLOAD_RATE = { max: 40, windowMs: 10 * 60_000 } as const
export const PORTAL_MESSAGE_SEND_RATE = { max: 30, windowMs: 10 * 60_000 } as const
export const PORTAL_LOG_ERROR_RATE = { max: 60, windowMs: 10 * 60_000 } as const
export const PORTAL_EPK_EXPORT_RATE = { max: 10, windowMs: 10 * 60_000 } as const
