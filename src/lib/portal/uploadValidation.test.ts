import { describe, expect, it } from 'vitest'
import { validatePortalUpload, PORTAL_ASSET_RULES, PORTAL_PHOTO_RULES } from './uploadValidation'

function makeFile(size: number, type: string): File {
  return new File([new Uint8Array(size)], 'test.bin', { type })
}

describe('validatePortalUpload', () => {
  it('returns null for valid asset uploads', () => {
    const file = makeFile(1024, 'image/png')
    expect(validatePortalUpload(file, PORTAL_ASSET_RULES)).toBeNull()
  })

  it('rejects files over the size limit', () => {
    const file = makeFile(PORTAL_ASSET_RULES.maxBytes + 1, 'image/png')
    expect(validatePortalUpload(file, PORTAL_ASSET_RULES)).toMatch(/too large/i)
  })

  it('rejects unsupported MIME types', () => {
    const file = makeFile(1024, 'application/x-msdownload')
    expect(validatePortalUpload(file, PORTAL_ASSET_RULES)).toMatch(/unsupported/i)
  })

  it('accepts GIF for photo uploads', () => {
    const file = makeFile(1024, 'image/gif')
    expect(validatePortalUpload(file, PORTAL_PHOTO_RULES)).toBeNull()
  })
})