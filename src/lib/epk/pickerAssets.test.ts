import { describe, expect, it } from 'vitest'
import { buildEpkPickerAssets } from './pickerAssets'
import type { Artist, ArtistAsset } from '@/types'
import type { ArtistProfile } from '@/lib/api/artistProfiles'

const artist = {
  id: 'artist-1',
  name: 'Test Artist',
  slug: 'test-artist',
  imageUrl: 'https://cdn.example.com/profile.jpg',
  logoUrl: 'https://cdn.example.com/logo.png',
  genres: [],
  bio: '',
  featured: false,
  isVisible: true,
} satisfies Artist

const profile = {
  id: 'profile-1',
  artistId: 'artist-1',
  epkGalleryPhotos: ['https://cdn.example.com/gallery-1.jpg'],
  epkTheme: 'default',
  epkLayout: 'classic',
  epkOrientation: 'portrait',
  epkBgOpacity: 20,
  epkSectionsOrder: [],
  epkSectionsHidden: [],
  epkPasswordSections: [],
  epkCustomThemeTokens: {},
  customLinks: [],
  epkDocumentVersion: 1,
  epkEditorMode: 'canvas',
  onboardingCompleted: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
} as unknown as ArtistProfile

const uploadAsset: ArtistAsset = {
  id: 'asset-1',
  artistId: 'artist-1',
  filename: 'live.jpg',
  originalFilename: 'live.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 1024,
  r2Key: 'artist-assets/live.jpg',
  publicUrl: 'https://cdn.example.com/live.jpg',
  createdAt: '2026-01-01',
}

describe('buildEpkPickerAssets', () => {
  it('merges uploads, profile photo, gallery, and label assets', () => {
    const assets = buildEpkPickerAssets({
      artist,
      artistProfile: profile,
      artistAssets: [uploadAsset],
      labelAssets: [
        {
          id: 'label-1',
          filename: 'press.jpg',
          originalFilename: 'press.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          r2Key: 'assets/press.jpg',
          publicUrl: 'https://cdn.example.com/press.jpg',
          createdAt: '2026-01-01',
          artistIds: [],
          tags: [],
          isPressApproved: true,
          pressSuggested: false,
          downloadableForPress: true,
        },
      ],
    })

    expect(assets.map((asset) => asset.publicUrl)).toEqual([
      'https://cdn.example.com/live.jpg',
      'https://cdn.example.com/press.jpg',
      'https://cdn.example.com/profile.jpg',
      'https://cdn.example.com/logo.png',
      'https://cdn.example.com/gallery-1.jpg',
    ])
  })
})