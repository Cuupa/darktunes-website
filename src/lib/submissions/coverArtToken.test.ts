import { describe, it, expect } from 'vitest'
import { mintCoverArtToken, verifyCoverArtToken } from './coverArtToken'

const SECRET = 'a'.repeat(64)

describe('coverArtToken', () => {
  it('mints and verifies a valid token for the same URL', () => {
    const url = 'https://drive.google.com/file/d/abc123/view'
    const token = mintCoverArtToken(SECRET, { url, width: 3000, height: 3000, format: 'jpeg' })
    const result = verifyCoverArtToken(SECRET, token, url)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.width).toBe(3000)
      expect(result.payload.height).toBe(3000)
    }
  })

  it('rejects expired tokens', () => {
    const url = 'https://drive.google.com/uc?export=download&id=x'
    const token = mintCoverArtToken(
      SECRET,
      { url, width: 3000, height: 3000 },
      Date.now() - 60 * 60 * 1000,
    )
    // exp was set relative to past now → already expired when verified with present
    const result = verifyCoverArtToken(SECRET, token, url, Date.now())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('expired')
  })

  it('rejects URL mismatch', () => {
    const token = mintCoverArtToken(SECRET, {
      url: 'https://drive.google.com/file/d/aaa/view',
      width: 3000,
      height: 3000,
    })
    const result = verifyCoverArtToken(SECRET, token, 'https://drive.google.com/file/d/bbb/view')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('url_mismatch')
  })

  it('rejects tampered signature', () => {
    const url = 'https://drive.google.com/file/d/abc/view'
    const token = mintCoverArtToken(SECRET, { url, width: 3000, height: 3000 })
    const bad = token.slice(0, -4) + 'xxxx'
    const result = verifyCoverArtToken(SECRET, bad, url)
    expect(result.ok).toBe(false)
  })
})
