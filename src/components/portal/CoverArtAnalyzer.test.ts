/**
 * Tests for the pure-logic helpers used by CoverArtAnalyzer.
 *
 * The functions `checkJpegMagicBytes` and `checkImageDimensions` are not
 * exported from the component, so we re-implement the same pure logic here
 * to verify the JPEG magic-byte detection and dimension-validation rules.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

// ----- Pure helpers (mirrors logic in CoverArtAnalyzer) -----

function isJpegMagicBytes(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

function isValidCoverSize(width: number, height: number): boolean {
  return width === 3000 && height === 3000
}

function fallbackExtensionIsJpeg(url: string): boolean {
  const lower = url.toLowerCase()
  return lower.includes('.jpg') || lower.includes('.jpeg')
}

// ----- Tests -----

describe('CoverArtAnalyzer — JPEG magic-byte detection', () => {
  it('detects valid JPEG magic bytes (FF D8 FF)', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
    expect(isJpegMagicBytes(bytes)).toBe(true)
  })

  it('rejects PNG magic bytes (89 50 4E 47)', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])
    expect(isJpegMagicBytes(bytes)).toBe(false)
  })

  it('rejects GIF magic bytes (47 49 46)', () => {
    const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    expect(isJpegMagicBytes(bytes)).toBe(false)
  })

  it('rejects WebP magic bytes', () => {
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00])
    expect(isJpegMagicBytes(bytes)).toBe(false)
  })

  it('rejects short buffer (fewer than 3 bytes)', () => {
    const bytes = new Uint8Array([0xff, 0xd8])
    expect(isJpegMagicBytes(bytes)).toBe(false)
  })

  it('rejects all-zero buffer', () => {
    const bytes = new Uint8Array(12)
    expect(isJpegMagicBytes(bytes)).toBe(false)
  })
})

describe('CoverArtAnalyzer — cover size validation', () => {
  it('accepts exactly 3000×3000', () => {
    expect(isValidCoverSize(3000, 3000)).toBe(true)
  })

  it('rejects 1500×1500', () => {
    expect(isValidCoverSize(1500, 1500)).toBe(false)
  })

  it('rejects 3000×2999 (height off by one)', () => {
    expect(isValidCoverSize(3000, 2999)).toBe(false)
  })

  it('rejects 2999×3000 (width off by one)', () => {
    expect(isValidCoverSize(2999, 3000)).toBe(false)
  })

  it('rejects 4000×4000', () => {
    expect(isValidCoverSize(4000, 4000)).toBe(false)
  })
})

describe('CoverArtAnalyzer — fallback URL-extension check', () => {
  it('accepts .jpg extension', () => {
    expect(fallbackExtensionIsJpeg('https://example.com/cover.jpg')).toBe(true)
  })

  it('accepts .jpeg extension', () => {
    expect(fallbackExtensionIsJpeg('https://example.com/cover.jpeg')).toBe(true)
  })

  it('accepts uppercase .JPG extension', () => {
    expect(fallbackExtensionIsJpeg('https://example.com/COVER.JPG')).toBe(true)
  })

  it('rejects .png extension', () => {
    expect(fallbackExtensionIsJpeg('https://example.com/cover.png')).toBe(false)
  })

  it('rejects .webp extension', () => {
    expect(fallbackExtensionIsJpeg('https://example.com/cover.webp')).toBe(false)
  })

  it('rejects a URL with no extension', () => {
    expect(fallbackExtensionIsJpeg('https://drive.google.com/file/d/abc123/view')).toBe(false)
  })
})

describe('CoverArtAnalyzer — fetch-based magic byte check (mocked)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function checkJpegMagicBytesFetch(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, {
        headers: { Range: 'bytes=0-11' },
        mode: 'cors' as RequestMode,
        cache: 'no-store' as RequestCache,
      })
      if (!res.ok && res.status !== 206) return false
      const buf = await res.arrayBuffer()
      const bytes = new Uint8Array(buf)
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    } catch {
      return false
    }
  }

  it('returns true for a valid JPEG response', async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(jpegBytes.buffer as ArrayBuffer),
    } as Response)
    const result = await checkJpegMagicBytesFetch('https://example.com/cover.jpg')
    expect(result).toBe(true)
  })

  it('returns true for a 206 Partial Content response', async () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 206,
      arrayBuffer: () => Promise.resolve(jpegBytes.buffer as ArrayBuffer),
    } as Response)
    const result = await checkJpegMagicBytesFetch('https://example.com/cover.jpg')
    expect(result).toBe(true)
  })

  it('returns false for a non-JPEG response', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(pngBytes.buffer as ArrayBuffer),
    } as Response)
    const result = await checkJpegMagicBytesFetch('https://example.com/cover.png')
    expect(result).toBe(false)
  })

  it('returns false when fetch throws (CORS error)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('CORS error'))
    const result = await checkJpegMagicBytesFetch('https://example.com/cover.jpg')
    expect(result).toBe(false)
  })

  it('returns false when server returns 403', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    } as Response)
    const result = await checkJpegMagicBytesFetch('https://example.com/cover.jpg')
    expect(result).toBe(false)
  })
})
