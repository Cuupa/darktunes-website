import { describe, it, expect } from 'vitest'
import { getOptimizedImageUrl, getSquareThumbnail } from './imageUtils'

describe('getOptimizedImageUrl', () => {
  it('returns an empty string for empty input', () => {
    expect(getOptimizedImageUrl('', 400)).toBe('')
  })

  it('returns a wsrv.nl URL with the correct parameters', () => {
    const url = getOptimizedImageUrl('https://cdn.darktunes.com/cover.jpg', 400)
    expect(url).toContain('https://wsrv.nl/')
    expect(url).toContain('output=webp')
    expect(url).toContain('w=400')
    expect(url).toContain(encodeURIComponent('https://cdn.darktunes.com/cover.jpg'))
  })

  it('encodes special characters in the source URL', () => {
    const src = 'https://cdn.example.com/path with spaces/image.jpg'
    const result = getOptimizedImageUrl(src, 200)
    // encodeURIComponent encodes spaces as %20
    expect(result).toContain('path%20with%20spaces')
  })

  it('uses the supplied width', () => {
    const result = getOptimizedImageUrl('https://cdn.example.com/img.jpg', 1200)
    expect(result).toContain('w=1200')
  })
})

describe('getSquareThumbnail', () => {
  it('returns an empty string for empty input', () => {
    expect(getSquareThumbnail('', 300)).toBe('')
  })

  it('returns a wsrv.nl URL with square crop parameters', () => {
    const url = getSquareThumbnail('https://cdn.darktunes.com/cover.jpg', 300)
    expect(url).toContain('https://wsrv.nl/')
    expect(url).toContain('w=300')
    expect(url).toContain('h=300')
    expect(url).toContain('fit=cover')
    expect(url).toContain('output=webp')
  })

  it('uses the same value for width and height', () => {
    const result = getSquareThumbnail('https://cdn.example.com/img.jpg', 150)
    expect(result).toContain('w=150')
    expect(result).toContain('h=150')
  })
})
