import { BRONZE_SINGLE_PUT_MAX_BYTES } from '@/lib/sos/bronzeUploadLimits'
import { PORTAL_RELEASE_COVER_MAX_BYTES } from '@/lib/uploads/portalUploadLimits'

export const RELEASE_SUBMISSION_ASSET_PREFIX = 'release-submissions'
export const RELEASE_SUBMISSION_ASSET_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const PORTAL_RELEASE_AUDIO_MAX_BYTES = BRONZE_SINGLE_PUT_MAX_BYTES

export const PORTAL_RELEASE_AUDIO_MIME = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/flac',
  'audio/x-flac',
  'audio/aiff',
  'audio/x-aiff',
  'audio/mpeg',
  'audio/mp3',
])

export type ReleaseSubmissionAssetKind = 'audio' | 'cover'

const EXT_BY_MIME: Record<string, string> = {
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/aiff': 'aiff',
  'audio/x-aiff': 'aiff',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function releaseSubmissionAssetMaxBytes(kind: ReleaseSubmissionAssetKind): number {
  return kind === 'cover' ? PORTAL_RELEASE_COVER_MAX_BYTES : PORTAL_RELEASE_AUDIO_MAX_BYTES
}

export function isAllowedReleaseSubmissionAssetMime(
  kind: ReleaseSubmissionAssetKind,
  contentType: string,
): boolean {
  if (kind === 'cover') return contentType === 'image/jpeg'
  return PORTAL_RELEASE_AUDIO_MIME.has(contentType)
}

export function extensionForAssetMime(contentType: string): string {
  return EXT_BY_MIME[contentType] ?? 'bin'
}

export function isOwnedReleaseSubmissionKey(r2Key: string, artistId: string): boolean {
  return r2Key.startsWith(`${RELEASE_SUBMISSION_ASSET_PREFIX}/${artistId}/`)
}

export function buildReleaseSubmissionAssetKey(
  artistId: string,
  uploadId: string,
  contentType: string,
): string {
  return `${RELEASE_SUBMISSION_ASSET_PREFIX}/${artistId}/${uploadId}.${extensionForAssetMime(contentType)}`
}

export function assetsExpireAt(from = new Date()): string {
  return new Date(from.getTime() + RELEASE_SUBMISSION_ASSET_TTL_MS).toISOString()
}

export function formatUploadMb(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  const text = mb.toFixed(1)
  return `${text.endsWith('.0') ? text.slice(0, -2) : text} MB`
}

export function r2CoverTokenUrl(r2Key: string): string {
  return `r2:${r2Key}`
}
