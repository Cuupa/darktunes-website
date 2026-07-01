import { describe, expect, it } from 'vitest'
import {
  galleryUrlToPressAsset,
  mergePortalGalleryPhotos,
  r2KeyFromPublicUrl,
} from './portalGalleryPress'
import type { PressAsset } from '@/types'

const kitPhoto: PressAsset = {
  id: 'asset-1',
  filename: 'live.jpg',
  originalFilename: 'live.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 1024,
  r2Key: 'press-photos/live.jpg',
  publicUrl: 'https://cdn.example.com/press-photos/live.jpg',
  createdAt: '2026-01-01T00:00:00Z',
  artistIds: [],
  tags: [],
  isPressApproved: true,
  pressSuggested: false,
  downloadableForPress: true,
  kitItemId: 'kit-1',
  kitDisplayOrder: 0,
  kitArtistId: 'artist-1',
}

describe('r2KeyFromPublicUrl', () => {
  it('extracts the pathname without a leading slash', () => {
    const url = 'https://cdn.darktunes.com/profile-photos/artist-1/abc.webp'
    expect(r2KeyFromPublicUrl(url)).toBe('profile-photos/artist-1/abc.webp')
  })

  it('matches assets when only the CDN host changes', () => {
    const oldUrl = 'https://old-cdn.example.com/profile-photos/artist-1/abc.webp'
    const newUrl = 'https://cdn.example.com/profile-photos/artist-1/abc.webp'
    expect(r2KeyFromPublicUrl(oldUrl)).toBe(r2KeyFromPublicUrl(newUrl))
  })
})

describe('galleryUrlToPressAsset', () => {
  it('maps a profile gallery URL to a downloadable press asset', () => {
    const url = 'https://cdn.example.com/profile-photos/artist-1/photo.webp'
    const asset = galleryUrlToPressAsset(url, 'artist-1', 2)

    expect(asset.publicUrl).toBe(url)
    expect(asset.mimeType).toBe('image/webp')
    expect(asset.isPressApproved).toBe(true)
    expect(asset.downloadableForPress).toBe(true)
    expect(asset.kitDisplayOrder).toBe(2)
    expect(asset.tags).toContain('portal_gallery')
  })
})

describe('mergePortalGalleryPhotos', () => {
  it('appends gallery URLs that are not already in the curated kit', () => {
    const galleryUrl = 'https://cdn.example.com/profile-photos/artist-1/gallery.jpg'
    const merged = mergePortalGalleryPhotos([kitPhoto], [galleryUrl], 'artist-1')

    expect(merged).toHaveLength(2)
    expect(merged[0].publicUrl).toBe(kitPhoto.publicUrl)
    expect(merged[1].publicUrl).toBe(galleryUrl)
  })

  it('deduplicates gallery URLs already present in the kit', () => {
    const merged = mergePortalGalleryPhotos([kitPhoto], [kitPhoto.publicUrl], 'artist-1')
    expect(merged).toHaveLength(1)
  })
})