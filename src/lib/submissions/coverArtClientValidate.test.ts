import { describe, it, expect, vi, afterEach } from 'vitest'
import { validateCoverArtFile, SUBMISSION_COVER_MAX_BYTES } from './coverArtClientValidate'

function mockFile(bytes: number[], type = 'image/jpeg', name = 'cover.jpg'): File {
  const buf = new Uint8Array(bytes)
  return new File([buf], name, { type })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('validateCoverArtFile', () => {
  it('rejects non-JPEG magic bytes', async () => {
    // PNG header
    const file = mockFile([0x89, 0x50, 0x4e, 0x47], 'image/png', 'x.png')
    const r = await validateCoverArtFile(file)
    expect(r.verified).toBe(false)
    expect(r.status).toBe('wrong_format')
  })

  it('rejects oversized files before decode', async () => {
    const big = new Uint8Array(SUBMISSION_COVER_MAX_BYTES + 1)
    big[0] = 0xff
    big[1] = 0xd8
    big[2] = 0xff
    const file = new File([big], 'huge.jpg', { type: 'image/jpeg' })
    const r = await validateCoverArtFile(file)
    expect(r.verified).toBe(false)
    expect(r.status).toBe('too_large')
  })

  it('accepts JPEG magic + 3000×3000 via createImageBitmap', async () => {
    const jpegHeader = [0xff, 0xd8, 0xff, 0xe0]
    const file = mockFile(jpegHeader)
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({
        width: 3000,
        height: 3000,
        close: vi.fn(),
      }),
    )
    const r = await validateCoverArtFile(file)
    expect(r.verified).toBe(true)
    expect(r.status).toBe('ok')
    expect(r.width).toBe(3000)
  })

  it('rejects wrong dimensions', async () => {
    const file = mockFile([0xff, 0xd8, 0xff])
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({
        width: 1500,
        height: 1500,
        close: vi.fn(),
      }),
    )
    const r = await validateCoverArtFile(file)
    expect(r.verified).toBe(false)
    expect(r.status).toBe('wrong_size')
    expect(r.width).toBe(1500)
  })
})
