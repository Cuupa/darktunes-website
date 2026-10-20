import { describe, expect, it } from 'vitest'
import { BRONZE_SINGLE_PUT_MAX_BYTES } from '@/lib/sos/bronzeUploadLimits'
import {
  PORTAL_RELEASE_AUDIO_MAX_BYTES,
  buildReleaseSubmissionAssetKey,
  isAllowedReleaseSubmissionAssetMime,
  isOwnedReleaseSubmissionKey,
} from './submissionAssets'

describe('submissionAssets', () => {
  it('reuses the bronze single-PUT cap for audio', () => {
    expect(PORTAL_RELEASE_AUDIO_MAX_BYTES).toBe(BRONZE_SINGLE_PUT_MAX_BYTES)
  })

  it('allows jpeg covers and zip/wav audio', () => {
    expect(isAllowedReleaseSubmissionAssetMime('cover', 'image/jpeg')).toBe(true)
    expect(isAllowedReleaseSubmissionAssetMime('cover', 'image/png')).toBe(false)
    expect(isAllowedReleaseSubmissionAssetMime('audio', 'application/zip')).toBe(true)
    expect(isAllowedReleaseSubmissionAssetMime('audio', 'video/mp4')).toBe(false)
  })

  it('scopes keys to the artist', () => {
    const key = buildReleaseSubmissionAssetKey('artist-1', 'u1', 'audio/wav')
    expect(isOwnedReleaseSubmissionKey(key, 'artist-1')).toBe(true)
    expect(isOwnedReleaseSubmissionKey(key, 'other')).toBe(false)
  })
})
