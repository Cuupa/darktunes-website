/**
 * src/lib/epk/migrate/legacyToDocumentV2.ts
 *
 * Converts legacy artist_epks column-based EPK settings into an EpkDocumentV2
 * canvas JSON document with positioned elements.
 */

import type { ArtistProfile } from '@/lib/api/artistProfiles'
import type { Artist } from '@/types'
import type { EPKSectionId } from '@/lib/epk/themes'
import { DEFAULT_SECTIONS_ORDER } from '@/lib/epk/themes'
import type { EpkDocumentV2, EpkElement, EpkPage } from '@/lib/epk/schema/documentV2'
import { createEpkElementId, createEpkPageId } from '@/lib/epk/schema/elementIds'
import { getPageDimensions } from '@/lib/epk/schema/pageDimensions'
import { resolveEpkThemeColors } from './themeColors'
import { stripHtml, truncateText } from './stripHtml'

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

export interface LegacyEpkInput {
  profile: ArtistProfile
  artist: Artist
  labelName?: string
}

// ---------------------------------------------------------------------------
// Section content builders
// ---------------------------------------------------------------------------

interface SectionBlock {
  heading: string
  body: string
  role: string
}

function getVisibleSections(profile: ArtistProfile): EPKSectionId[] {
  const order = profile.epkSectionsOrder.length > 0
    ? (profile.epkSectionsOrder as EPKSectionId[])
    : DEFAULT_SECTIONS_ORDER
  const hidden = new Set(profile.epkSectionsHidden)
  return order.filter((id) => !hidden.has(id))
}

function buildSectionBlocks(input: LegacyEpkInput): SectionBlock[] {
  const { profile, artist } = input
  const blocks: SectionBlock[] = []
  const sections = getVisibleSections(profile)

  for (const sectionId of sections) {
    if (sectionId === 'header') continue

    switch (sectionId) {
      case 'quote':
        if (profile.pressQuote) {
          blocks.push({
            role: 'quote',
            heading: 'Press Quote',
            body: `"${profile.pressQuote}"`,
          })
        }
        break
      case 'bio': {
        const bio =
          stripHtml(profile.bioLong) ||
          stripHtml(profile.bioMedium) ||
          stripHtml(profile.bioShort) ||
          stripHtml(artist.bio)
        if (bio) {
          blocks.push({ role: 'bio', heading: 'Biography', body: truncateText(bio, 2000) })
        }
        break
      }
      case 'gallery':
        if (profile.epkGalleryPhotos.length > 0) {
          blocks.push({
            role: 'gallery',
            heading: 'Gallery',
            body: `${profile.epkGalleryPhotos.length} press photo(s)`,
          })
        }
        break
      case 'info': {
        const lines: string[] = []
        if (artist.genres?.length) lines.push(`Genres: ${artist.genres.join(', ')}`)
        if (artist.hometown) lines.push(`Hometown: ${artist.hometown}`)
        if (artist.foundedYear) lines.push(`Founded: ${artist.foundedYear}`)
        if (lines.length) {
          blocks.push({ role: 'info', heading: 'Artist Info', body: lines.join('\n') })
        }
        break
      }
      case 'contacts': {
        const lines: string[] = []
        if (profile.bookingContact) lines.push(`Booking: ${profile.bookingContact}`)
        if (profile.pressContact) lines.push(`Press: ${profile.pressContact}`)
        if (lines.length) {
          blocks.push({ role: 'contacts', heading: 'Contacts', body: lines.join('\n') })
        }
        break
      }
      case 'riders': {
        const riders: string[] = []
        if (profile.riderStagePlotUrl) riders.push('Stage Plot available')
        if (profile.riderTechnicalUrl) riders.push('Technical Rider available')
        if (profile.riderHospitalityUrl) riders.push('Hospitality Rider available')
        if (riders.length) {
          blocks.push({ role: 'riders', heading: 'Riders', body: riders.join('\n') })
        }
        break
      }
      case 'links': {
        const links: string[] = []
        if (artist.websiteUrl) links.push(`Website: ${artist.websiteUrl}`)
        if (artist.spotifyUrl) links.push(`Spotify: ${artist.spotifyUrl}`)
        if (artist.instagramUrl) links.push(`Instagram: ${artist.instagramUrl}`)
        if (artist.youtubeUrl) links.push(`YouTube: ${artist.youtubeUrl}`)
        for (const link of profile.customLinks) {
          if (link.url) links.push(`${link.label}: ${link.url}`)
        }
        if (links.length) {
          blocks.push({ role: 'links', heading: 'Links', body: links.join('\n') })
        }
        break
      }
    }
  }

  return blocks
}

// ---------------------------------------------------------------------------
// Layout-specific header
// ---------------------------------------------------------------------------

interface HeaderLayout {
  headerHeight: number
  photoX: number
  photoY: number
  photoSize: number
  nameX: number
  nameY: number
  nameWidth: number
  genreY: number
}

function getHeaderLayout(
  layout: ArtistProfile['epkLayout'],
  pageWidth: number,
): HeaderLayout {
  const padding = 48

  switch (layout) {
    case 'magazine':
      return {
        headerHeight: 320,
        photoX: padding,
        photoY: padding,
        photoSize: pageWidth - padding * 2,
        nameX: padding,
        nameY: padding + (pageWidth - padding * 2) + 24,
        nameWidth: pageWidth - padding * 2,
        genreY: padding + (pageWidth - padding * 2) + 64,
      }
    case 'minimal':
      return {
        headerHeight: 140,
        photoX: padding,
        photoY: padding,
        photoSize: 72,
        nameX: padding + 88,
        nameY: padding + 8,
        nameWidth: pageWidth - padding - 88 - padding,
        genreY: padding + 48,
      }
    case 'full-bleed':
      return {
        headerHeight: 280,
        photoX: padding,
        photoY: 120,
        photoSize: 140,
        nameX: padding + 160,
        nameY: 140,
        nameWidth: pageWidth - padding - 160 - padding,
        genreY: 200,
      }
    case 'classic':
    default:
      return {
        headerHeight: 200,
        photoX: padding,
        photoY: padding,
        photoSize: 120,
        nameX: padding + 140,
        nameY: padding + 24,
        nameWidth: pageWidth - padding - 140 - padding,
        genreY: padding + 72,
      }
  }
}

// ---------------------------------------------------------------------------
// Element factories
// ---------------------------------------------------------------------------

function makeTextElement(
  pageId: string,
  opts: {
    x: number
    y: number
    width: number
    height: number
    content: string
    zIndex: number
    role?: string
    fontSize?: number
    fontWeight?: number | string
    fill?: string
    textAlign?: 'left' | 'center' | 'right'
  },
): EpkElement {
  return {
    id: createEpkElementId('text'),
    pageId,
    type: 'text',
    x: opts.x,
    y: opts.y,
    width: opts.width,
    height: opts.height,
    rotation: 0,
    zIndex: opts.zIndex,
    locked: false,
    visible: true,
    role: opts.role,
    content: opts.content,
    style: {
      fill: opts.fill ?? '#ffffff',
      fontSize: opts.fontSize ?? 14,
      fontWeight: opts.fontWeight ?? 400,
      fontFamily: 'Helvetica',
      textAlign: opts.textAlign ?? 'left',
      lineHeight: 1.4,
    },
  }
}

function makeShapeElement(
  pageId: string,
  opts: {
    x: number
    y: number
    width: number
    height: number
    fill: string
    zIndex: number
    role?: string
    opacity?: number
  },
): EpkElement {
  return {
    id: createEpkElementId('shape'),
    pageId,
    type: 'shape',
    x: opts.x,
    y: opts.y,
    width: opts.width,
    height: opts.height,
    rotation: 0,
    zIndex: opts.zIndex,
    locked: false,
    visible: true,
    role: opts.role,
    style: {
      fill: opts.fill,
      opacity: opts.opacity,
    },
  }
}

function makeImageElement(
  pageId: string,
  opts: {
    x: number
    y: number
    width: number
    height: number
    src: string
    zIndex: number
    role?: string
  },
): EpkElement {
  return {
    id: createEpkElementId('image'),
    pageId,
    type: 'image',
    x: opts.x,
    y: opts.y,
    width: opts.width,
    height: opts.height,
    rotation: 0,
    zIndex: opts.zIndex,
    locked: false,
    visible: true,
    role: opts.role,
    src: opts.src,
    style: {},
  }
}

// ---------------------------------------------------------------------------
// Main migration
// ---------------------------------------------------------------------------

export function legacyToDocumentV2(input: LegacyEpkInput): EpkDocumentV2 {
  const { profile, artist, labelName } = input
  const colors = resolveEpkThemeColors(profile)
  const dims = getPageDimensions('a4', profile.epkOrientation)
  const pageId = createEpkPageId(0)

  const page: EpkPage = {
    id: pageId,
    name: 'Page 1',
    width: dims.width,
    height: dims.height,
    background: profile.epkBgImageUrl
      ? {
          type: 'image',
          src: profile.epkBgImageUrl,
          opacity: profile.epkBgOpacity / 100,
        }
      : {
          type: 'color',
          color: colors.background,
        },
  }

  const elements: EpkElement[] = []
  let z = 1

  // Full-bleed background overlay
  if (profile.epkLayout === 'full-bleed' && profile.epkBgImageUrl) {
    elements.push(
      makeShapeElement(pageId, {
        x: 0,
        y: 0,
        width: dims.width,
        height: dims.height,
        fill: colors.background,
        zIndex: z++,
        role: 'bg-overlay',
        opacity: 1 - profile.epkBgOpacity / 100,
      }),
    )
  } else if (profile.epkBgImageUrl && profile.epkLayout !== 'full-bleed') {
    elements.push(
      makeImageElement(pageId, {
        x: 0,
        y: 0,
        width: dims.width,
        height: dims.height,
        src: profile.epkBgImageUrl,
        zIndex: z++,
        role: 'background',
      }),
    )
    elements.push(
      makeShapeElement(pageId, {
        x: 0,
        y: 0,
        width: dims.width,
        height: dims.height,
        fill: colors.background,
        zIndex: z++,
        role: 'bg-overlay',
        opacity: 1 - profile.epkBgOpacity / 100,
      }),
    )
  }

  const header = getHeaderLayout(profile.epkLayout, dims.width)

  // Header band
  elements.push(
    makeShapeElement(pageId, {
      x: 0,
      y: 0,
      width: dims.width,
      height: header.headerHeight,
      fill: colors.headerBg,
      zIndex: z++,
      role: 'header-band',
    }),
  )

  // EPK label
  elements.push(
    makeTextElement(pageId, {
      x: header.nameX,
      y: profile.epkLayout === 'magazine' ? header.nameY - 40 : 48,
      width: 200,
      height: 20,
      content: 'ELECTRONIC PRESS KIT',
      zIndex: z++,
      role: 'header-label',
      fontSize: 10,
      fontWeight: 600,
      fill: colors.accent,
    }),
  )

  // Artist photo
  if (artist.imageUrl) {
    const photoW = profile.epkLayout === 'magazine' ? header.photoSize : header.photoSize
    const photoH = profile.epkLayout === 'magazine' ? 200 : header.photoSize
    elements.push(
      makeImageElement(pageId, {
        x: header.photoX,
        y: header.photoY,
        width: photoW,
        height: photoH,
        src: artist.imageUrl,
        zIndex: z++,
        role: 'artist-photo',
      }),
    )
  }

  // Artist name
  elements.push(
    makeTextElement(pageId, {
      x: header.nameX,
      y: header.nameY,
      width: header.nameWidth,
      height: 48,
      content: artist.name,
      zIndex: z++,
      role: 'artist-name',
      fontSize: profile.epkLayout === 'minimal' ? 24 : 32,
      fontWeight: 700,
      fill: colors.text,
    }),
  )

  // Genres badge
  if (artist.genres?.length) {
    elements.push(
      makeTextElement(pageId, {
        x: header.nameX,
        y: header.genreY,
        width: header.nameWidth,
        height: 24,
        content: artist.genres.join(' · '),
        zIndex: z++,
        role: 'genres',
        fontSize: 11,
        fill: colors.muted,
      }),
    )
  }

  // Body sections
  const blocks = buildSectionBlocks(input)
  let cursorY = header.headerHeight + 32
  const bodyPadding = 48
  const bodyWidth = dims.width - bodyPadding * 2

  for (const block of blocks) {
    elements.push(
      makeTextElement(pageId, {
        x: bodyPadding,
        y: cursorY,
        width: bodyWidth,
        height: 20,
        content: block.heading.toUpperCase(),
        zIndex: z++,
        role: `${block.role}-heading`,
        fontSize: 10,
        fontWeight: 600,
        fill: colors.heading,
      }),
    )
    cursorY += 28

    const lineCount = block.body.split('\n').length
    const bodyHeight = Math.max(40, lineCount * 20)

    elements.push(
      makeTextElement(pageId, {
        x: bodyPadding,
        y: cursorY,
        width: bodyWidth,
        height: bodyHeight,
        content: block.body,
        zIndex: z++,
        role: block.role,
        fontSize: 13,
        fill: colors.text,
      }),
    )
    cursorY += bodyHeight + 24
  }

  // Gallery images (first 3 thumbnails in a row)
  if (profile.epkGalleryPhotos.length > 0 && getVisibleSections(profile).includes('gallery')) {
    const thumbSize = Math.min(160, (bodyWidth - 32) / 3)
    profile.epkGalleryPhotos.slice(0, 3).forEach((url, i) => {
      if (!url) return
      elements.push(
        makeImageElement(pageId, {
          x: bodyPadding + i * (thumbSize + 16),
          y: cursorY,
          width: thumbSize,
          height: thumbSize,
          src: url,
          zIndex: z++,
          role: 'gallery-image',
        }),
      )
    })
    cursorY += thumbSize + 24
  }

  // Footer
  const footerY = dims.height - 56
  elements.push(
    makeShapeElement(pageId, {
      x: 0,
      y: footerY,
      width: dims.width,
      height: 56,
      fill: colors.headerBg,
      zIndex: z++,
      role: 'footer-band',
    }),
  )
  elements.push(
    makeTextElement(pageId, {
      x: bodyPadding,
      y: footerY + 18,
      width: bodyWidth,
      height: 20,
      content: labelName ? `${labelName} · ${artist.name}` : artist.name,
      zIndex: z++,
      role: 'footer',
      fontSize: 9,
      fill: colors.muted,
    }),
  )

  return {
    version: 2,
    pageFormat: 'a4',
    orientation: profile.epkOrientation,
    pages: [page],
    elements,
    fonts: [],
    metadata: {
      title: `${artist.name} — Electronic Press Kit`,
      author: labelName ?? artist.name,
      subject: 'Electronic Press Kit',
      keywords: ['EPK', artist.name, ...(artist.genres ?? [])],
    },
  }
}