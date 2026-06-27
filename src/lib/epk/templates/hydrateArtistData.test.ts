import { describe, expect, it } from 'vitest'
import { hydrateTemplateWithArtistData } from './hydrateArtistData'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import type { Artist } from '@/types'

const artist = {
  id: 'a1',
  name: 'Dark Band',
  slug: 'dark-band',
  genres: ['Metal', 'Gothic'],
  imageUrl: 'https://cdn.example/photo.jpg',
  logoUrl: 'https://cdn.example/logo.png',
  bio: '<p>Legacy bio</p>',
} as Artist

const baseDoc: EpkDocumentV2 = {
  version: 2,
  pageFormat: 'a4',
  orientation: 'portrait',
  pages: [{ id: 'p1', width: 794, height: 1123, background: { type: 'color', color: '#101010' } }],
  elements: [
    {
      id: 't1',
      pageId: 'p1',
      type: 'text',
      role: 'artist-name',
      x: 0,
      y: 0,
      width: 200,
      height: 40,
      rotation: 0,
      zIndex: 1,
      locked: false,
      visible: true,
      content: 'Artist Name',
      style: {},
    },
    {
      id: 'i1',
      pageId: 'p1',
      type: 'image',
      role: 'artist-photo',
      x: 0,
      y: 50,
      width: 200,
      height: 200,
      rotation: 0,
      zIndex: 2,
      locked: false,
      visible: true,
      style: {},
    },
  ],
  fonts: [],
  metadata: {},
}

describe('hydrateTemplateWithArtistData', () => {
  it('fills artist name and photo from artist record', () => {
    const hydrated = hydrateTemplateWithArtistData(baseDoc, artist, null, [])
    expect(hydrated.elements.find((e) => e.id === 't1')?.content).toBe('Dark Band')
    expect(hydrated.elements.find((e) => e.id === 'i1')?.src).toBe('https://cdn.example/photo.jpg')
    expect(hydrated.metadata.title).toBe('Dark Band')
  })
})