import { describe, expect, it } from 'vitest'
import type { Release, Video } from '@/types'
import type { EpkDocumentV2 } from '@/lib/epk/schema/documentV2'
import { buildCatalogImportElement } from './catalogImport'

const document: EpkDocumentV2 = {
  version: 2,
  pageFormat: 'a4',
  orientation: 'portrait',
  pages: [
    {
      id: 'page-1',
      width: 794,
      height: 1123,
      background: { type: 'color', color: '#101010' },
    },
  ],
  elements: [],
  fonts: [],
  metadata: {},
}

const pageId = document.pages[0]!.id

const release: Release = {
  id: 'rel-1',
  title: 'Dark Waves',
  artistId: 'a1',
  artistName: 'Extize',
  releaseDate: '2026-06-15',
  coverArt: '',
  type: 'single',
  featured: false,
  isVisible: true,
  isPromo: false,
  smartlinkUrl: 'https://link.example/presave',
}

const video: Video = {
  id: 'vid-1',
  title: 'Live Session',
  artistName: 'Extize',
  artistId: 'a1',
  youtubeId: 'abc123xyz',
  thumbnailUrl: '',
  publishedAt: '2026-01-01',
  isVisible: true,
  isShort: false,
}

describe('buildCatalogImportElement', () => {
  it('returns null when nothing is selected', () => {
    expect(buildCatalogImportElement(pageId, document, [], [])).toBeNull()
  })

  it('includes release lines with smartlink', () => {
    const element = buildCatalogImportElement(pageId, document, [release], [])
    expect(element?.content).toContain('Releases')
    expect(element?.content).toContain('Dark Waves (SINGLE)')
    expect(element?.content).toContain('https://link.example/presave')
  })

  it('includes youtube links for videos', () => {
    const element = buildCatalogImportElement(pageId, document, [], [video])
    expect(element?.content).toContain('Videos')
    expect(element?.content).toContain('https://www.youtube.com/watch?v=abc123xyz')
  })
})