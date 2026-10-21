import { describe, expect, it } from 'vitest'
import { isArtistVideoThumbnailUrl } from './portalUploadLimits'

const BASE = 'https://cdn.example.com'
const ARTIST = '11111111-1111-1111-1111-111111111111'

describe('isArtistVideoThumbnailUrl', () => {
  it('accepts this artist’s R2 thumbnail', () => {
    expect(
      isArtistVideoThumbnailUrl(
        `${BASE}/video-submissions/${ARTIST}/abc.jpg`,
        BASE,
        ARTIST,
      ),
    ).toBe(true)
  })

  it('rejects another artist, another host, or a non-https URL', () => {
    expect(
      isArtistVideoThumbnailUrl(
        `${BASE}/video-submissions/22222222-2222-2222-2222-222222222222/abc.jpg`,
        BASE,
        ARTIST,
      ),
    ).toBe(false)
    expect(
      isArtistVideoThumbnailUrl(
        `https://evil.example/video-submissions/${ARTIST}/abc.jpg`,
        BASE,
        ARTIST,
      ),
    ).toBe(false)
    expect(
      isArtistVideoThumbnailUrl(
        `http://cdn.example.com/video-submissions/${ARTIST}/abc.jpg`,
        BASE,
        ARTIST,
      ),
    ).toBe(false)
  })
})
