import { describe, it, expect } from 'vitest'
import { getOptimizedImageUrl, getSquareThumbnail, processHtmlImages } from './imageUtils'

describe('getOptimizedImageUrl', () => {
  it('returns an empty string for empty input', () => {
    expect(getOptimizedImageUrl('', 400)).toBe('')
  })

  it('returns a wsrv.nl URL with the correct parameters', () => {
    const url = getOptimizedImageUrl('https://cdn.darktunes.com/cover.jpg', 400)
    expect(url).toContain('https://wsrv.nl/')
    expect(url).toContain('output=webp')
    expect(url).toContain('q=75')
    expect(url).toContain('n=-1')
    expect(url).toContain('maxage=31d')
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
    expect(url).toContain('maxage=31d')
  })

  it('uses the same value for width and height', () => {
    const result = getSquareThumbnail('https://cdn.example.com/img.jpg', 150)
    expect(result).toContain('w=150')
    expect(result).toContain('h=150')
  })
})

describe('processHtmlImages', () => {
  it('returns empty string unchanged', () => {
    expect(processHtmlImages('')).toBe('')
  })

  it('rewrites img src through wsrv.nl', () => {
    const html = '<p><img src="https://cdn.example.com/photo.jpg" alt="test"></p>'
    const result = processHtmlImages(html)
    expect(result).toContain('wsrv.nl')
    expect(result).toContain('output=webp')
    expect(result).toContain(encodeURIComponent('https://cdn.example.com/photo.jpg'))
  })

  it('leaves already-proxied wsrv.nl URLs untouched', () => {
    const proxied = 'https://wsrv.nl/?url=https%3A%2F%2Fcdn.example.com%2Fimg.jpg&w=800&output=webp&maxage=31d'
    const html = `<img src="${proxied}">`
    expect(processHtmlImages(html)).toBe(html)
  })

  it('leaves data: URIs untouched', () => {
    const html = '<img src="data:image/png;base64,abc123">'
    expect(processHtmlImages(html)).toBe(html)
  })

  it('uses supplied width', () => {
    const html = '<img src="https://cdn.example.com/img.jpg">'
    const result = processHtmlImages(html, 400)
    expect(result).toContain('w=400')
  })

  it('does not alter non-img content', () => {
    const html = '<p>Hello world</p>'
    expect(processHtmlImages(html)).toBe(html)
  })
})
