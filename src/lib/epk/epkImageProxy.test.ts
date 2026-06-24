import { describe, expect, it, vi } from 'vitest'
import {
  buildEpkProxyImageUrl,
  isAllowedEpkImageUrl,
  isPrivateOrLoopbackHost,
  resolveEpkCanvasImageSrc,
} from './epkImageProxy'

describe('epkImageProxy', () => {
  describe('isPrivateOrLoopbackHost', () => {
    it('blocks localhost and private IPv4 ranges', () => {
      expect(isPrivateOrLoopbackHost('localhost')).toBe(true)
      expect(isPrivateOrLoopbackHost('127.0.0.1')).toBe(true)
      expect(isPrivateOrLoopbackHost('10.0.0.1')).toBe(true)
      expect(isPrivateOrLoopbackHost('192.168.1.1')).toBe(true)
      expect(isPrivateOrLoopbackHost('metadata.google.internal')).toBe(true)
    })

    it('allows public hostnames', () => {
      expect(isPrivateOrLoopbackHost('cdn.darktunes.com')).toBe(false)
      expect(isPrivateOrLoopbackHost('i.scdn.co')).toBe(false)
    })
  })

  describe('isAllowedEpkImageUrl', () => {
    it('allows known CDN hostnames', () => {
      expect(isAllowedEpkImageUrl('https://i.scdn.co/image/abc')).toBe(true)
      expect(isAllowedEpkImageUrl('https://wsrv.nl/?url=example.com')).toBe(true)
      expect(isAllowedEpkImageUrl('https://abc123.r2.dev/profile.jpg')).toBe(true)
      expect(isAllowedEpkImageUrl('https://xyz.supabase.co/storage/v1/object/public/x.jpg')).toBe(true)
    })

    it('rejects private/loopback hosts', () => {
      expect(isAllowedEpkImageUrl('http://127.0.0.1/secret')).toBe(false)
      expect(isAllowedEpkImageUrl('http://localhost/image.jpg')).toBe(false)
    })

    it('includes custom R2 CDN hostname from env', () => {
      expect(
        isAllowedEpkImageUrl(
          'https://cdn.darktunes.com/profile-photos/x.jpg',
          'https://cdn.darktunes.com',
        ),
      ).toBe(true)
    })
  })

  describe('resolveEpkCanvasImageSrc', () => {
    it('returns data and blob URIs unchanged', () => {
      const dataUri = 'data:image/png;base64,abc'
      const blobUri = 'blob:https://darktunes.com/abc'
      expect(resolveEpkCanvasImageSrc(dataUri)).toBe(dataUri)
      expect(resolveEpkCanvasImageSrc(blobUri)).toBe(blobUri)
    })

    it('rewrites remote HTTPS URLs through the portal proxy in the browser', () => {
      vi.stubGlobal('window', { location: { origin: 'https://darktunes.com' } })
      expect(resolveEpkCanvasImageSrc('https://abc123.r2.dev/photo.jpg')).toBe(
        'https://darktunes.com/api/portal/proxy-image?url=' +
          encodeURIComponent('https://abc123.r2.dev/photo.jpg'),
      )
      vi.unstubAllGlobals()
    })
  })

  describe('buildEpkProxyImageUrl', () => {
    it('rewrites absolute HTTPS URLs to the proxy route', () => {
      const result = buildEpkProxyImageUrl(
        'https://cdn.darktunes.com/photo.jpg',
        'https://darktunes.com',
      )
      expect(result).toBe(
        'https://darktunes.com/api/portal/proxy-image?url=' +
          encodeURIComponent('https://cdn.darktunes.com/photo.jpg'),
      )
    })

    it('returns data URIs unchanged', () => {
      const dataUri = 'data:image/png;base64,abc'
      expect(buildEpkProxyImageUrl(dataUri, 'https://darktunes.com')).toBe(dataUri)
    })
  })
})