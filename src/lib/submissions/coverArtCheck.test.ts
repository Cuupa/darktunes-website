import { describe, it, expect, vi, afterEach } from 'vitest'
import sharp from 'sharp'
import { verifyCoverArtUrl } from './coverArtCheck'

async function jpegBuffer(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 20, g: 20, b: 20 },
    },
  })
    .jpeg()
    .toBuffer()
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('verifyCoverArtUrl', () => {
  it('rejects invalid URLs', async () => {
    const r = await verifyCoverArtUrl('not-a-url')
    expect(r.verified).toBe(false)
    expect(r.status).toBe('invalid_url')
  })

  it('rejects forbidden hosts', async () => {
    const r = await verifyCoverArtUrl('https://evil.example.com/cover.jpg')
    expect(r.verified).toBe(false)
    expect(r.status).toBe('forbidden_host')
  })

  function mockImageResponse(buf: Buffer, contentType = 'image/jpeg') {
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': contentType }),
      arrayBuffer: async () =>
        buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
    }
  }

  it('accepts valid 3000×3000 JPEG from allowed host', async () => {
    const buf = await jpegBuffer(3000, 3000)
    const fetchFn = vi.fn().mockResolvedValue(mockImageResponse(buf))

    const r = await verifyCoverArtUrl('https://drive.google.com/file/d/abc/view', {
      fetchFn: fetchFn as unknown as typeof fetch,
    })
    expect(r.verified).toBe(true)
    expect(r.status).toBe('ok')
    expect(r.width).toBe(3000)
    expect(r.height).toBe(3000)
    expect(fetchFn).toHaveBeenCalled()
  })

  it('rejects wrong dimensions', async () => {
    const buf = await jpegBuffer(1500, 1500)
    const fetchFn = vi.fn().mockResolvedValue(mockImageResponse(buf))

    const r = await verifyCoverArtUrl('https://drive.google.com/uc?export=download&id=x', {
      fetchFn: fetchFn as unknown as typeof fetch,
    })
    expect(r.verified).toBe(false)
    expect(r.status).toBe('wrong_size')
    expect(r.width).toBe(1500)
  })

  it('rejects HTML virus-scan pages from Drive', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      arrayBuffer: async () => new TextEncoder().encode('<html>confirm</html>').buffer,
    })

    const r = await verifyCoverArtUrl('https://drive.google.com/file/d/abc/view', {
      fetchFn: fetchFn as unknown as typeof fetch,
    })
    expect(r.verified).toBe(false)
    expect(r.status).toBe('not_image')
  })

  it('rejects redirect to a non-allowlisted host', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 302,
      headers: new Headers({ location: 'http://127.0.0.1/secret.jpg' }),
      arrayBuffer: async () => new ArrayBuffer(0),
    })

    const r = await verifyCoverArtUrl('https://drive.google.com/uc?export=download&id=x', {
      fetchFn: fetchFn as unknown as typeof fetch,
    })
    expect(r.verified).toBe(false)
    expect(r.status).toBe('fetch_failed')
  })
})
