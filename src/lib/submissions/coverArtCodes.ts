/**
 * Stable cover-art check codes for API responses and i18n mapping.
 */

import type { CoverArtCheckStatus } from '@/lib/submissions/coverArtCheck'

export type CoverArtErrorCode =
  | 'COVER_OK'
  | 'COVER_INVALID_URL'
  | 'COVER_FORBIDDEN_HOST'
  | 'COVER_FETCH_FAILED'
  | 'COVER_NOT_IMAGE'
  | 'COVER_WRONG_FORMAT'
  | 'COVER_WRONG_SIZE'
  | 'COVER_TOO_LARGE'

export function coverStatusToCode(status: CoverArtCheckStatus): CoverArtErrorCode {
  switch (status) {
    case 'ok':
      return 'COVER_OK'
    case 'invalid_url':
      return 'COVER_INVALID_URL'
    case 'forbidden_host':
      return 'COVER_FORBIDDEN_HOST'
    case 'fetch_failed':
      return 'COVER_FETCH_FAILED'
    case 'not_image':
      return 'COVER_NOT_IMAGE'
    case 'wrong_format':
      return 'COVER_WRONG_FORMAT'
    case 'wrong_size':
      return 'COVER_WRONG_SIZE'
    case 'too_large':
      return 'COVER_TOO_LARGE'
    default:
      return 'COVER_FETCH_FAILED'
  }
}

/** Portal i18n key under `portal.*` for a cover error code. */
export function coverCodeToI18nKey(code: CoverArtErrorCode): string {
  switch (code) {
    case 'COVER_OK':
      return 'releases_submit_cover_check_ok'
    case 'COVER_INVALID_URL':
    case 'COVER_FORBIDDEN_HOST':
      return 'releases_submit_cover_check_blocked'
    case 'COVER_FETCH_FAILED':
    case 'COVER_NOT_IMAGE':
      return 'releases_submit_cover_check_drive_help'
    case 'COVER_WRONG_FORMAT':
      return 'releases_submit_cover_check_wrong_format'
    case 'COVER_WRONG_SIZE':
      return 'releases_submit_cover_check_wrong_size'
    case 'COVER_TOO_LARGE':
      return 'releases_submit_cover_check_too_large'
    default:
      return 'releases_submit_cover_check_drive_help'
  }
}
