import { describe, it, expect } from 'vitest'
import {
  extractGoogleDriveFileId,
  isAllowedCoverArtUrl,
  isJpegMagicBytes,
  isValidCoverArtSize,
  normalizeCoverArtUrl,
} from './coverArtUrl'

describe('extractGoogleDriveFileId', () => {
  it('parses /file/d/{id}/view URLs', () => {
    expect(
      extractGoogleDriveFileId('https://drive.google.com/file/d/abc123XYZ/view?usp=sharing'),
    ).toBe('abc123XYZ')
  })

  it('parses open?id= URLs', () => {
    expect(extractGoogleDriveFileId('https://drive.google.com/open?id=fileId99')).toBe('fileId99')
  })

  it('parses uc?export=download&id=', () => {
    expect(
      extractGoogleDriveFileId('https://drive.google.com/uc?export=download&id=dlId1'),
    ).toBe('dlId1')
  })

  it('returns null for non-Drive URLs', () => {
    expect(extractGoogleDriveFileId('https://example.com/cover.jpg')).toBeNull()
  })
})

describe('normalizeCoverArtUrl', () => {
  it('converts Drive share links to uc export URLs', () => {
    expect(
      normalizeCoverArtUrl('https://drive.google.com/file/d/abc123/view?usp=sharing'),
    ).toBe('https://drive.google.com/uc?export=download&id=abc123')
  })

  it('sets dl=1 on Dropbox share links', () => {
    const out = normalizeCoverArtUrl('https://www.dropbox.com/s/xyz/cover.jpg?dl=0')
    expect(out).toContain('dl=1')
  })

  it('leaves ordinary image URLs unchanged', () => {
    const url = 'https://cdn.example.r2.dev/covers/a.jpg'
    // r2.dev matches allowlist pattern host-wise; normalize only rewrites known share patterns
    expect(normalizeCoverArtUrl(url)).toBe(url)
  })
})

describe('isAllowedCoverArtUrl', () => {
  it('allows Drive hosts', () => {
    expect(isAllowedCoverArtUrl('https://drive.google.com/uc?export=download&id=x')).toBe(true)
  })

  it('allows googleusercontent', () => {
    expect(isAllowedCoverArtUrl('https://lh3.googleusercontent.com/d/x')).toBe(true)
  })

  it('rejects private IPs', () => {
    expect(isAllowedCoverArtUrl('http://127.0.0.1/secret.jpg')).toBe(false)
    expect(isAllowedCoverArtUrl('http://192.168.1.1/x.jpg')).toBe(false)
  })

  it('rejects unknown hosts', () => {
    expect(isAllowedCoverArtUrl('https://evil.example.com/x.jpg')).toBe(false)
  })
})

describe('isJpegMagicBytes / isValidCoverArtSize', () => {
  it('detects JPEG magic', () => {
    expect(isJpegMagicBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true)
    expect(isJpegMagicBytes(new Uint8Array([0x89, 0x50, 0x4e]))).toBe(false)
  })

  it('requires exact 3000×3000', () => {
    expect(isValidCoverArtSize(3000, 3000)).toBe(true)
    expect(isValidCoverArtSize(1500, 1500)).toBe(false)
  })
})
