import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createFanPagePreviewToken,
  verifyFanPagePreviewToken,
} from '@/lib/fan-page/previewToken'

describe('fan page preview token', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('creates and verifies a valid token', () => {
    vi.stubEnv('FAN_PAGE_PREVIEW_SECRET', 'test-preview-secret')
    const token = createFanPagePreviewToken('artist-uuid', 'my-artist')
    const verified = verifyFanPagePreviewToken(token, 'my-artist')
    expect(verified).toEqual({ artistId: 'artist-uuid', slug: 'my-artist' })
  })

  it('rejects tokens for a different slug', () => {
    vi.stubEnv('FAN_PAGE_PREVIEW_SECRET', 'test-preview-secret')
    const token = createFanPagePreviewToken('artist-uuid', 'my-artist')
    expect(verifyFanPagePreviewToken(token, 'other-artist')).toBeNull()
  })

  it('rejects tampered tokens', () => {
    vi.stubEnv('FAN_PAGE_PREVIEW_SECRET', 'test-preview-secret')
    const token = createFanPagePreviewToken('artist-uuid', 'my-artist')
    const tampered = `${token}x`
    expect(verifyFanPagePreviewToken(tampered, 'my-artist')).toBeNull()
  })
})