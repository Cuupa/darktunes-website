import type { EpkTemplate } from '@/lib/api/epkTemplates'
import type { EpkDocumentV2, EpkElement, EpkOrientation, EpkPageFormat } from '@/lib/epk/schema/documentV2'
import { createEpkElementId, createEpkPageId } from '@/lib/epk/schema/elementIds'
import { getPageDimensions } from '@/lib/epk/schema/pageDimensions'
import { applyPaletteToDocument } from './applyPalette'
import { DEFAULT_EPK_PALETTE_ID } from './colorPalettes'

export type EpkTemplateCategory = 'one-page' | 'multi-page' | 'social'

export interface EpkBuiltinTemplateMeta {
  category: EpkTemplateCategory
  pageFormat: EpkPageFormat
  orientation: EpkOrientation
  pageCount: number
  defaultPaletteId: string
}

export interface EpkBuiltinTemplate extends EpkTemplate {
  meta: EpkBuiltinTemplateMeta
}

function buildDocument(
  name: string,
  format: EpkPageFormat,
  orientation: EpkOrientation,
  pageDefs: Array<{ name: string; elements: Omit<EpkElement, 'pageId'>[] }>,
): EpkDocumentV2 {
  const dims = getPageDimensions(format, orientation)
  const pages = pageDefs.map((def, index) => ({
    id: createEpkPageId(index),
    name: def.name,
    width: dims.width,
    height: dims.height,
    background: { type: 'color' as const, color: '#101010' },
  }))

  const elements: EpkElement[] = []
  pageDefs.forEach((def, index) => {
    const pageId = pages[index]!.id
    for (const el of def.elements) {
      elements.push({ ...el, pageId })
    }
  })

  return {
    version: 2,
    pageFormat: format,
    orientation,
    pages,
    elements,
    fonts: [],
    metadata: { title: name, themePaletteId: DEFAULT_EPK_PALETTE_ID },
  }
}

function textEl(
  partial: Omit<EpkElement, 'id' | 'pageId' | 'type' | 'locked' | 'visible' | 'rotation' | 'zIndex'> & {
    zIndex: number
  },
): Omit<EpkElement, 'pageId'> {
  return {
    id: createEpkElementId('text'),
    type: 'text',
    rotation: 0,
    locked: false,
    visible: true,
    ...partial,
  }
}

function shapeEl(
  partial: Omit<EpkElement, 'id' | 'pageId' | 'type' | 'locked' | 'visible' | 'rotation' | 'zIndex'> & {
    zIndex: number
  },
): Omit<EpkElement, 'pageId'> {
  return {
    id: createEpkElementId('shape'),
    type: 'shape',
    rotation: 0,
    locked: false,
    visible: true,
    ...partial,
  }
}

function imageEl(
  partial: Omit<EpkElement, 'id' | 'pageId' | 'type' | 'locked' | 'visible' | 'rotation' | 'zIndex'> & {
    zIndex: number
  },
): Omit<EpkElement, 'pageId'> {
  return {
    id: createEpkElementId('image'),
    type: 'image',
    rotation: 0,
    locked: false,
    visible: true,
    ...partial,
  }
}

const W = 794
const H = 1123
const margin = 48
const contentW = W - margin * 2

function classicPortrait(): EpkDocumentV2 {
  return buildDocument('Classic Press Kit', 'a4', 'portrait', [{
    name: 'Page 1',
    elements: [
      shapeEl({
        x: 0, y: 0, width: W, height: 200, zIndex: 1, role: 'header-band',
        style: { fill: '#1a1530', opacity: 1 },
      }),
      textEl({
        x: margin, y: 56, width: 500, height: 56, zIndex: 2, role: 'artist-name',
        content: 'Artist Name',
        style: { fill: '#ffffff', fontSize: 36, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.2 },
      }),
      textEl({
        x: margin, y: 120, width: 400, height: 32, zIndex: 3, role: 'genres',
        content: 'Genre · Genre · Genre',
        style: { fill: '#b8a8e8', fontSize: 14, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.4 },
      }),
      textEl({
        x: margin, y: 240, width: contentW, height: 40, zIndex: 4, role: 'bio-heading',
        content: 'Biography',
        style: { fill: '#ffffff', fontSize: 20, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.3 },
      }),
      textEl({
        x: margin, y: 290, width: contentW, height: 200, zIndex: 5, role: 'bio',
        content: 'Add your artist biography here. Use quick-insert to pull text from your profile.',
        style: { fill: '#d8d8d8', fontSize: 13, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.5 },
      }),
      textEl({
        x: margin, y: 520, width: contentW, height: 40, zIndex: 6, role: 'links-heading',
        content: 'Links & Social',
        style: { fill: '#ffffff', fontSize: 18, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.3 },
      }),
      textEl({
        x: margin, y: 570, width: contentW, height: 120, zIndex: 7, role: 'links',
        content: 'Spotify: …\nInstagram: …\nWebsite: …',
        style: { fill: '#b8a8e8', fontSize: 12, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.6 },
      }),
    ],
  }])
}

function minimalPortrait(): EpkDocumentV2 {
  return buildDocument('Minimal One-Pager', 'a4', 'portrait', [{
    name: 'Page 1',
    elements: [
      textEl({
        x: margin, y: 80, width: contentW, height: 64, zIndex: 1, role: 'artist-name',
        content: 'ARTIST NAME',
        style: { fill: '#ffffff', fontSize: 42, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'center', lineHeight: 1.1 },
      }),
      shapeEl({
        x: 347, y: 160, width: 100, height: 3, zIndex: 2, role: 'accent-line',
        style: { fill: '#493687', opacity: 1 },
      }),
      textEl({
        x: 96, y: 200, width: 602, height: 280, zIndex: 3, role: 'bio',
        content: 'Short bio paragraph. Replace with your profile text via quick-insert.',
        style: { fill: '#d8d8d8', fontSize: 14, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'center', lineHeight: 1.55 },
      }),
      textEl({
        x: 96, y: 520, width: 602, height: 100, zIndex: 4, role: 'contacts',
        content: 'Booking: …\nPress: …',
        style: { fill: '#ffffff', fontSize: 12, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'center', lineHeight: 1.6 },
      }),
    ],
  }])
}

function magazinePortrait(): EpkDocumentV2 {
  return buildDocument('Magazine Layout', 'a4', 'portrait', [{
    name: 'Page 1',
    elements: [
      shapeEl({
        x: 0, y: 0, width: W, height: 420, zIndex: 1, role: 'header-band',
        style: { fill: '#1a1530', opacity: 1 },
      }),
      imageEl({
        x: margin, y: 48, width: 320, height: 320, zIndex: 2, role: 'artist-photo',
        src: undefined,
        style: { opacity: 1, objectFit: 'cover' },
      }),
      textEl({
        x: 400, y: 80, width: 346, height: 120, zIndex: 3, role: 'artist-name',
        content: 'Artist\nName',
        style: { fill: '#ffffff', fontSize: 40, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.15 },
      }),
      textEl({
        x: 400, y: 220, width: 346, height: 80, zIndex: 4, role: 'quote',
        content: '"Press quote goes here."',
        style: { fill: '#b8a8e8', fontSize: 15, fontStyle: 'italic', fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.5 },
      }),
      textEl({
        x: margin, y: 460, width: contentW, height: 300, zIndex: 5, role: 'bio',
        content: 'Long-form biography. Insert from profile or edit inline.',
        style: { fill: '#d8d8d8', fontSize: 13, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.55 },
      }),
    ],
  }])
}

function landscapeSpotlight(): EpkDocumentV2 {
  const dims = getPageDimensions('a4', 'landscape')
  const lw = dims.width
  const lh = dims.height
  return buildDocument('Landscape Spotlight', 'a4', 'landscape', [{
    name: 'Page 1',
    elements: [
      imageEl({
        x: 0, y: 0, width: Math.round(lw * 0.45), height: lh, zIndex: 1, role: 'artist-photo',
        src: undefined,
        style: { opacity: 1, objectFit: 'cover' },
      }),
      shapeEl({
        x: Math.round(lw * 0.45), y: 0, width: Math.round(lw * 0.55), height: lh, zIndex: 2, role: 'header-band',
        style: { fill: '#1a1530', opacity: 1 },
      }),
      textEl({
        x: Math.round(lw * 0.48), y: 80, width: Math.round(lw * 0.48), height: 80, zIndex: 3, role: 'artist-name',
        content: 'Artist Name',
        style: { fill: '#ffffff', fontSize: 44, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.1 },
      }),
      textEl({
        x: Math.round(lw * 0.48), y: 170, width: Math.round(lw * 0.48), height: 32, zIndex: 4, role: 'genres',
        content: 'Genre · Genre',
        style: { fill: '#b8a8e8', fontSize: 14, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.4 },
      }),
      textEl({
        x: Math.round(lw * 0.48), y: 240, width: Math.round(lw * 0.48), height: 200, zIndex: 5, role: 'bio',
        content: 'Short bio for landscape press sheets. Quick-insert from profile.',
        style: { fill: '#d8d8d8', fontSize: 13, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.5 },
      }),
      textEl({
        x: Math.round(lw * 0.48), y: 480, width: Math.round(lw * 0.48), height: 100, zIndex: 6, role: 'contacts',
        content: 'Booking: …\nPress: …',
        style: { fill: '#ffffff', fontSize: 12, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.6 },
      }),
    ],
  }])
}

function squareSocial(): EpkDocumentV2 {
  const S = 794
  return buildDocument('Square Social Kit', 'square', 'portrait', [{
    name: 'Page 1',
    elements: [
      shapeEl({
        x: 0, y: 0, width: S, height: S, zIndex: 1, role: 'header-band',
        style: { fill: '#1a1530', opacity: 1 },
      }),
      imageEl({
        x: 48, y: 48, width: 280, height: 280, zIndex: 2, role: 'artist-photo',
        src: undefined,
        style: { opacity: 1, objectFit: 'cover', cornerRadius: 8 },
      }),
      textEl({
        x: 360, y: 80, width: 380, height: 100, zIndex: 3, role: 'artist-name',
        content: 'Artist\nName',
        style: { fill: '#ffffff', fontSize: 36, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.1 },
      }),
      textEl({
        x: 360, y: 200, width: 380, height: 120, zIndex: 4, role: 'bio',
        content: 'One-paragraph bio for social snippets and quick press shares.',
        style: { fill: '#d8d8d8', fontSize: 12, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.45 },
      }),
      textEl({
        x: 48, y: 360, width: 698, height: 80, zIndex: 5, role: 'links',
        content: 'Spotify · Instagram · Website',
        style: { fill: '#b8a8e8', fontSize: 13, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'center', lineHeight: 1.5 },
      }),
      textEl({
        x: 48, y: 460, width: 698, height: 60, zIndex: 6, role: 'contacts',
        content: 'Booking: …',
        style: { fill: '#ffffff', fontSize: 11, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'center', lineHeight: 1.5 },
      }),
    ],
  }])
}

function twoPageDossier(): EpkDocumentV2 {
  return buildDocument('Two-Page Dossier', 'a4', 'portrait', [
    {
      name: 'Cover',
      elements: [
        shapeEl({
          x: 0, y: 0, width: W, height: H, zIndex: 1, role: 'header-band',
          style: { fill: '#1a1530', opacity: 1 },
        }),
        imageEl({
          x: margin, y: 200, width: contentW, height: 500, zIndex: 2, role: 'artist-photo',
          src: undefined,
          style: { opacity: 1, objectFit: 'cover' },
        }),
        textEl({
          x: margin, y: 760, width: contentW, height: 80, zIndex: 3, role: 'artist-name',
          content: 'ARTIST NAME',
          style: { fill: '#ffffff', fontSize: 48, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'center', lineHeight: 1.1 },
        }),
        textEl({
          x: margin, y: 860, width: contentW, height: 40, zIndex: 4, role: 'genres',
          content: 'Electronic Press Kit',
          style: { fill: '#b8a8e8', fontSize: 14, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'center', lineHeight: 1.4 },
        }),
      ],
    },
    {
      name: 'Details',
      elements: [
        textEl({
          x: margin, y: 56, width: contentW, height: 48, zIndex: 1, role: 'bio-heading',
          content: 'Biography',
          style: { fill: '#ffffff', fontSize: 24, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.2 },
        }),
        textEl({
          x: margin, y: 120, width: contentW, height: 360, zIndex: 2, role: 'bio',
          content: 'Full biography. Use quick-insert for long bio from your profile.',
          style: { fill: '#d8d8d8', fontSize: 13, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.55 },
        }),
        textEl({
          x: margin, y: 520, width: contentW, height: 40, zIndex: 3, role: 'links-heading',
          content: 'Press & Booking',
          style: { fill: '#ffffff', fontSize: 18, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.3 },
        }),
        textEl({
          x: margin, y: 570, width: contentW, height: 120, zIndex: 4, role: 'contacts',
          content: 'Booking: …\nPress: …',
          style: { fill: '#ffffff', fontSize: 12, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.6 },
        }),
        textEl({
          x: margin, y: 720, width: contentW, height: 40, zIndex: 5, role: 'section-heading',
          content: 'Links',
          style: { fill: '#ffffff', fontSize: 18, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.3 },
        }),
        textEl({
          x: margin, y: 770, width: contentW, height: 120, zIndex: 6, role: 'links',
          content: 'Spotify: …\nInstagram: …\nWebsite: …',
          style: { fill: '#b8a8e8', fontSize: 12, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.6 },
        }),
      ],
    },
  ])
}

function threePagePressPack(): EpkDocumentV2 {
  return buildDocument('Three-Page Press Pack', 'a4', 'portrait', [
    {
      name: 'Cover',
      elements: [
        shapeEl({ x: 0, y: 0, width: W, height: 320, zIndex: 1, role: 'header-band', style: { fill: '#1a1530', opacity: 1 } }),
        textEl({
          x: margin, y: 120, width: contentW, height: 80, zIndex: 2, role: 'artist-name',
          content: 'Artist Name',
          style: { fill: '#ffffff', fontSize: 52, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'center', lineHeight: 1.1 },
        }),
        textEl({
          x: margin, y: 220, width: contentW, height: 40, zIndex: 3, role: 'genres',
          content: 'Genre · Genre · Genre',
          style: { fill: '#b8a8e8', fontSize: 14, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'center', lineHeight: 1.4 },
        }),
        imageEl({
          x: margin, y: 360, width: contentW, height: 500, zIndex: 4, role: 'artist-photo',
          src: undefined,
          style: { opacity: 1, objectFit: 'cover' },
        }),
      ],
    },
    {
      name: 'Bio & Quote',
      elements: [
        textEl({
          x: margin, y: 56, width: contentW, height: 100, zIndex: 1, role: 'quote',
          content: '"Press quote goes here."',
          style: { fill: '#b8a8e8', fontSize: 18, fontStyle: 'italic', fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'center', lineHeight: 1.5 },
        }),
        shapeEl({ x: 347, y: 170, width: 100, height: 3, zIndex: 2, role: 'accent-line', style: { fill: '#493687', opacity: 1 } }),
        textEl({
          x: margin, y: 200, width: contentW, height: 40, zIndex: 3, role: 'bio-heading',
          content: 'Biography',
          style: { fill: '#ffffff', fontSize: 22, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.3 },
        }),
        textEl({
          x: margin, y: 250, width: contentW, height: 500, zIndex: 4, role: 'bio',
          content: 'Long biography spanning the full page. Quick-insert from profile.',
          style: { fill: '#d8d8d8', fontSize: 13, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.55 },
        }),
        textEl({
          x: margin, y: 780, width: contentW, height: 80, zIndex: 5, role: 'info',
          content: 'Hometown: …\nFounded: …',
          style: { fill: '#d8d8d8', fontSize: 12, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.5 },
        }),
      ],
    },
    {
      name: 'Links & Riders',
      elements: [
        textEl({
          x: margin, y: 56, width: contentW, height: 40, zIndex: 1, role: 'links-heading',
          content: 'Links & Social',
          style: { fill: '#ffffff', fontSize: 22, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.3 },
        }),
        textEl({
          x: margin, y: 110, width: contentW, height: 200, zIndex: 2, role: 'links',
          content: 'Spotify: …\nInstagram: …\nYouTube: …\nWebsite: …',
          style: { fill: '#b8a8e8', fontSize: 12, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.6 },
        }),
        textEl({
          x: margin, y: 360, width: contentW, height: 40, zIndex: 3, role: 'section-heading',
          content: 'Booking & Press',
          style: { fill: '#ffffff', fontSize: 22, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.3 },
        }),
        textEl({
          x: margin, y: 410, width: contentW, height: 100, zIndex: 4, role: 'contacts',
          content: 'Booking: …\nPress: …',
          style: { fill: '#ffffff', fontSize: 13, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.6 },
        }),
        textEl({
          x: margin, y: 560, width: contentW, height: 40, zIndex: 5, role: 'section-heading',
          content: 'Technical Riders',
          style: { fill: '#ffffff', fontSize: 18, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.3 },
        }),
        textEl({
          x: margin, y: 610, width: contentW, height: 120, zIndex: 6, role: 'info',
          content: 'Stage plot, technical rider, and hospitality rider PDFs can be attached on export.',
          style: { fill: '#d8d8d8', fontSize: 12, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.5 },
        }),
      ],
    },
  ])
}

function letterClassic(): EpkDocumentV2 {
  const dims = getPageDimensions('letter', 'portrait')
  const lw = dims.width
  const m = 48
  const cw = lw - m * 2
  return buildDocument('Letter Classic', 'letter', 'portrait', [{
    name: 'Page 1',
    elements: [
      shapeEl({ x: 0, y: 0, width: lw, height: 180, zIndex: 1, role: 'header-band', style: { fill: '#1a1530', opacity: 1 } }),
      textEl({
        x: m, y: 48, width: cw, height: 56, zIndex: 2, role: 'artist-name',
        content: 'Artist Name',
        style: { fill: '#ffffff', fontSize: 34, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.2 },
      }),
      textEl({
        x: m, y: 110, width: cw, height: 32, zIndex: 3, role: 'genres',
        content: 'Genre · Genre',
        style: { fill: '#b8a8e8', fontSize: 13, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.4 },
      }),
      textEl({
        x: m, y: 220, width: cw, height: 36, zIndex: 4, role: 'bio-heading',
        content: 'Biography',
        style: { fill: '#ffffff', fontSize: 18, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.3 },
      }),
      textEl({
        x: m, y: 265, width: cw, height: 280, zIndex: 5, role: 'bio',
        content: 'US Letter format biography section.',
        style: { fill: '#d8d8d8', fontSize: 12, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.5 },
      }),
      textEl({
        x: m, y: 580, width: cw, height: 100, zIndex: 6, role: 'contacts',
        content: 'Booking: …\nPress: …',
        style: { fill: '#ffffff', fontSize: 12, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.6 },
      }),
    ],
  }])
}

function landscapeWideBrief(): EpkDocumentV2 {
  const dims = getPageDimensions('letter', 'landscape')
  const lw = dims.width
  const lh = dims.height
  return buildDocument('Landscape Wide Brief', 'letter', 'landscape', [{
    name: 'Page 1',
    elements: [
      shapeEl({ x: 0, y: 0, width: lw, height: 120, zIndex: 1, role: 'header-band', style: { fill: '#1a1530', opacity: 1 } }),
      textEl({
        x: 48, y: 32, width: 400, height: 56, zIndex: 2, role: 'artist-name',
        content: 'Artist Name',
        style: { fill: '#ffffff', fontSize: 36, fontWeight: 700, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.1 },
      }),
      textEl({
        x: lw - 300, y: 44, width: 252, height: 32, zIndex: 3, role: 'contacts',
        content: 'Booking: …',
        style: { fill: '#ffffff', fontSize: 11, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'right', lineHeight: 1.4 },
      }),
      imageEl({
        x: 48, y: 150, width: 280, height: lh - 180, zIndex: 4, role: 'artist-photo',
        src: undefined,
        style: { opacity: 1, objectFit: 'cover' },
      }),
      textEl({
        x: 360, y: 150, width: lw - 408, height: 80, zIndex: 5, role: 'quote',
        content: '"Press quote."',
        style: { fill: '#b8a8e8', fontSize: 15, fontStyle: 'italic', fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.5 },
      }),
      textEl({
        x: 360, y: 250, width: lw - 408, height: lh - 290, zIndex: 6, role: 'bio',
        content: 'Compact landscape brief for venue bookers and festival programmers.',
        style: { fill: '#d8d8d8', fontSize: 12, fontFamily: 'Helvetica, Arial, sans-serif', textAlign: 'left', lineHeight: 1.5 },
      }),
    ],
  }])
}

const BUILTIN_DEFS: Array<{
  id: string
  name: string
  description: string
  sortOrder: number
  meta: EpkBuiltinTemplateMeta
  build: () => EpkDocumentV2
}> = [
  {
    id: 'builtin-classic',
    name: 'Classic Press Kit',
    description: 'Portrait A4 — header band, bio, and social links.',
    sortOrder: 0,
    meta: { category: 'one-page', pageFormat: 'a4', orientation: 'portrait', pageCount: 1, defaultPaletteId: DEFAULT_EPK_PALETTE_ID },
    build: classicPortrait,
  },
  {
    id: 'builtin-minimal',
    name: 'Minimal One-Pager',
    description: 'Portrait A4 — centered typography with booking contacts.',
    sortOrder: 1,
    meta: { category: 'one-page', pageFormat: 'a4', orientation: 'portrait', pageCount: 1, defaultPaletteId: DEFAULT_EPK_PALETTE_ID },
    build: minimalPortrait,
  },
  {
    id: 'builtin-magazine',
    name: 'Magazine Layout',
    description: 'Portrait A4 — large photo, quote, and long bio block.',
    sortOrder: 2,
    meta: { category: 'one-page', pageFormat: 'a4', orientation: 'portrait', pageCount: 1, defaultPaletteId: DEFAULT_EPK_PALETTE_ID },
    build: magazinePortrait,
  },
  {
    id: 'builtin-landscape-spotlight',
    name: 'Landscape Spotlight',
    description: 'Landscape A4 — full-height photo with side content panel.',
    sortOrder: 3,
    meta: { category: 'one-page', pageFormat: 'a4', orientation: 'landscape', pageCount: 1, defaultPaletteId: DEFAULT_EPK_PALETTE_ID },
    build: landscapeSpotlight,
  },
  {
    id: 'builtin-square-social',
    name: 'Square Social Kit',
    description: 'Square format — compact layout for social and quick shares.',
    sortOrder: 4,
    meta: { category: 'social', pageFormat: 'square', orientation: 'portrait', pageCount: 1, defaultPaletteId: DEFAULT_EPK_PALETTE_ID },
    build: squareSocial,
  },
  {
    id: 'builtin-letter-classic',
    name: 'Letter Classic',
    description: 'US Letter portrait — standard North American print size.',
    sortOrder: 5,
    meta: { category: 'one-page', pageFormat: 'letter', orientation: 'portrait', pageCount: 1, defaultPaletteId: DEFAULT_EPK_PALETTE_ID },
    build: letterClassic,
  },
  {
    id: 'builtin-landscape-wide',
    name: 'Landscape Wide Brief',
    description: 'US Letter landscape — venue booker one-sheet.',
    sortOrder: 6,
    meta: { category: 'one-page', pageFormat: 'letter', orientation: 'landscape', pageCount: 1, defaultPaletteId: DEFAULT_EPK_PALETTE_ID },
    build: landscapeWideBrief,
  },
  {
    id: 'builtin-two-page',
    name: 'Two-Page Dossier',
    description: 'Portrait A4 — cover page plus detailed info page.',
    sortOrder: 7,
    meta: { category: 'multi-page', pageFormat: 'a4', orientation: 'portrait', pageCount: 2, defaultPaletteId: DEFAULT_EPK_PALETTE_ID },
    build: twoPageDossier,
  },
  {
    id: 'builtin-three-page',
    name: 'Three-Page Press Pack',
    description: 'Portrait A4 — cover, bio/quote, and links/riders.',
    sortOrder: 8,
    meta: { category: 'multi-page', pageFormat: 'a4', orientation: 'portrait', pageCount: 3, defaultPaletteId: DEFAULT_EPK_PALETTE_ID },
    build: threePagePressPack,
  },
]

function toBuiltinTemplate(def: (typeof BUILTIN_DEFS)[number]): EpkBuiltinTemplate {
  const document = applyPaletteToDocument(def.build(), def.meta.defaultPaletteId)
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    document,
    isPublished: true,
    sortOrder: def.sortOrder,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    meta: def.meta,
  }
}

export const BUILTIN_EPK_TEMPLATES: EpkBuiltinTemplate[] = BUILTIN_DEFS.map(toBuiltinTemplate)

export function getBuiltinTemplateMeta(templateId: string): EpkBuiltinTemplateMeta | undefined {
  return BUILTIN_EPK_TEMPLATES.find((t) => t.id === templateId)?.meta
}

export function mergeWithBuiltinTemplates(dbTemplates: EpkTemplate[]): EpkBuiltinTemplate[] {
  const dbNames = new Set(dbTemplates.map((t) => t.name.toLowerCase()))
  const builtins = BUILTIN_EPK_TEMPLATES.filter((t) => !dbNames.has(t.name.toLowerCase()))
  const dbWithMeta: EpkBuiltinTemplate[] = dbTemplates.map((t) => ({
    ...t,
    meta: {
      category: t.document.pages.length > 1 ? 'multi-page' : 'one-page',
      pageFormat: t.document.pageFormat,
      orientation: t.document.orientation,
      pageCount: t.document.pages.length,
      defaultPaletteId: t.document.metadata.themePaletteId ?? DEFAULT_EPK_PALETTE_ID,
    },
  }))
  return [...dbWithMeta, ...builtins].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}