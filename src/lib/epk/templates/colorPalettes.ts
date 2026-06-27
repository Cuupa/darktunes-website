/**
 * src/lib/epk/templates/colorPalettes.ts
 *
 * Semantic color palettes for EPK templates. Templates reference roles;
 * applyPalette() maps roles to these slots so themes swap instantly.
 */

export interface EpkColorPalette {
  id: string
  name: string
  colors: {
    background: string
    surface: string
    text: string
    textMuted: string
    accent: string
    accentSoft: string
  }
}

export const DEFAULT_EPK_PALETTE_ID = 'darktunes'

export const EPK_COLOR_PALETTES: EpkColorPalette[] = [
  {
    id: 'darktunes',
    name: 'darkTunes',
    colors: {
      background: '#101010',
      surface: '#1a1530',
      text: '#ffffff',
      textMuted: '#d8d8d8',
      accent: '#493687',
      accentSoft: '#b8a8e8',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    colors: {
      background: '#0a0f1a',
      surface: '#111b2e',
      text: '#f0f4ff',
      textMuted: '#b8c4dc',
      accent: '#2563eb',
      accentSoft: '#7eb3ff',
    },
  },
  {
    id: 'blood-moon',
    name: 'Blood Moon',
    colors: {
      background: '#120808',
      surface: '#2a1018',
      text: '#fff5f5',
      textMuted: '#e8c8c8',
      accent: '#7e1e37',
      accentSoft: '#d4849a',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: {
      background: '#0a120c',
      surface: '#142218',
      text: '#f0fff4',
      textMuted: '#c8dcc8',
      accent: '#2d6a4f',
      accentSoft: '#74c69d',
    },
  },
  {
    id: 'gold-luxe',
    name: 'Gold Luxe',
    colors: {
      background: '#0c0a08',
      surface: '#1a1610',
      text: '#faf6ee',
      textMuted: '#d4c8b0',
      accent: '#b8860b',
      accentSoft: '#e8c878',
    },
  },
  {
    id: 'arctic',
    name: 'Arctic',
    colors: {
      background: '#f4f6f8',
      surface: '#e8ecf0',
      text: '#1a1a2e',
      textMuted: '#4a4a5a',
      accent: '#3b5bdb',
      accentSoft: '#5c7cfa',
    },
  },
  {
    id: 'neon',
    name: 'Neon',
    colors: {
      background: '#080810',
      surface: '#120818',
      text: '#f0f0ff',
      textMuted: '#c0c0e8',
      accent: '#00d4ff',
      accentSoft: '#ff00aa',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    colors: {
      background: '#18181b',
      surface: '#27272a',
      text: '#fafafa',
      textMuted: '#a1a1aa',
      accent: '#52525b',
      accentSoft: '#a1a1aa',
    },
  },
]

const paletteById = new Map(EPK_COLOR_PALETTES.map((p) => [p.id, p]))

export function getEpkColorPalette(id: string | undefined): EpkColorPalette {
  return paletteById.get(id ?? DEFAULT_EPK_PALETTE_ID) ?? paletteById.get(DEFAULT_EPK_PALETTE_ID)!
}