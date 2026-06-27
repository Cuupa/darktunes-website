/**
 * src/lib/epk/templates/applyPalette.ts
 *
 * Recolors an EPK document by semantic element roles and page backgrounds.
 */

import type { EpkDocumentV2, EpkElement } from '@/lib/epk/schema/documentV2'
import {
  DEFAULT_EPK_PALETTE_ID,
  getEpkColorPalette,
  type EpkColorPalette,
} from './colorPalettes'

type ColorSlot = keyof EpkColorPalette['colors']

const ROLE_COLOR_MAP: Record<string, ColorSlot> = {
  'header-band': 'surface',
  'artist-name': 'text',
  'bio-heading': 'text',
  'links-heading': 'text',
  'section-heading': 'text',
  'page-title': 'text',
  bio: 'textMuted',
  info: 'textMuted',
  genres: 'accentSoft',
  links: 'accentSoft',
  quote: 'accentSoft',
  contacts: 'text',
  'accent-line': 'accent',
  'accent-block': 'accent',
}

function colorForElement(el: EpkElement, palette: EpkColorPalette): string | undefined {
  if (el.role && ROLE_COLOR_MAP[el.role]) {
    return palette.colors[ROLE_COLOR_MAP[el.role]]
  }

  if (el.type === 'shape') {
    if (el.height <= 6 && el.width >= 40) return palette.colors.accent
    if (el.y <= 4 && el.height >= el.width * 0.8) return palette.colors.surface
    return palette.colors.surface
  }

  if (el.type === 'text') {
    const weight = el.style.fontWeight
    const isBold = weight === 700 || weight === 'bold' || weight === '700'
    const isItalic = el.style.fontStyle === 'italic'
    if (isBold) return palette.colors.text
    if (isItalic) return palette.colors.accentSoft
    return palette.colors.textMuted
  }

  return undefined
}

export function applyPaletteToDocument(
  document: EpkDocumentV2,
  paletteId: string = DEFAULT_EPK_PALETTE_ID,
): EpkDocumentV2 {
  const palette = getEpkColorPalette(paletteId)
  const next = structuredClone(document)

  for (const page of next.pages) {
    if (page.background.type === 'color') {
      page.background.color = palette.colors.background
    } else if (page.background.type === 'gradient' && page.background.gradientStops?.length) {
      page.background.gradientStops = [
        { offset: 0, color: palette.colors.background },
        { offset: 0.55, color: palette.colors.surface },
        { offset: 1, color: palette.colors.accent },
      ]
    }
  }

  next.elements = next.elements.map((el) => {
    const color = colorForElement(el, palette)
    if (!color) return el

    if (el.type === 'text') {
      return {
        ...el,
        style: { ...el.style, fill: color },
      }
    }

    if (el.type === 'shape') {
      if (el.style.fillType === 'gradient' && el.style.gradientStops?.length) {
        return {
          ...el,
          style: {
            ...el.style,
            gradientStops: [
              { offset: 0, color: palette.colors.accent },
              { offset: 1, color: palette.colors.surface },
            ],
          },
        }
      }
      return {
        ...el,
        style: { ...el.style, fill: color },
      }
    }
    return el
  })

  next.metadata = {
    ...next.metadata,
    themePaletteId: paletteId,
  }

  return next
}

export function getDocumentPaletteId(document: EpkDocumentV2): string {
  return document.metadata.themePaletteId ?? DEFAULT_EPK_PALETTE_ID
}