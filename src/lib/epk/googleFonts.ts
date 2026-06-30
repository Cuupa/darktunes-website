/**
 * Curated Google Fonts for the EPK builder (CSS + PDF embed).
 */

export interface EpkGoogleFont {
  id: string
  family: string
  category: 'sans' | 'serif' | 'display'
  weights: number[]
}

export const EPK_GOOGLE_FONTS: EpkGoogleFont[] = [
  { id: 'inter', family: 'Inter', category: 'sans', weights: [400, 600, 700] },
  { id: 'roboto', family: 'Roboto', category: 'sans', weights: [400, 700] },
  { id: 'open-sans', family: 'Open Sans', category: 'sans', weights: [400, 600, 700] },
  { id: 'lato', family: 'Lato', category: 'sans', weights: [400, 700] },
  { id: 'montserrat', family: 'Montserrat', category: 'sans', weights: [400, 600, 700] },
  { id: 'oswald', family: 'Oswald', category: 'display', weights: [400, 600, 700] },
  { id: 'playfair', family: 'Playfair Display', category: 'serif', weights: [400, 700] },
  { id: 'merriweather', family: 'Merriweather', category: 'serif', weights: [400, 700] },
  { id: 'bebas', family: 'Bebas Neue', category: 'display', weights: [400] },
  { id: 'space-grotesk', family: 'Space Grotesk', category: 'sans', weights: [400, 600, 700] },
]

export function buildGoogleFontsCssUrl(families: string[]): string {
  const unique = [...new Set(families)]
  if (unique.length === 0) return ''
  const query = unique
    .map((family) => {
      const spec = EPK_GOOGLE_FONTS.find((f) => f.family === family)
      const weights = spec?.weights ?? [400, 700]
      return `family=${encodeURIComponent(family)}:wght@${weights.join(';')}`
    })
    .join('&')
  return `https://fonts.googleapis.com/css2?${query}&display=swap`
}

/** Direct TTF URL for pdf-lib embedding (Google Fonts v2 API). */
export function buildGoogleFontFileUrl(family: string, weight = 400): string {
  const encoded = encodeURIComponent(family)
  return `https://fonts.googleapis.com/css2?family=${encoded}:wght@${weight}&display=swap`
}

export function isGoogleFontFamily(family: string): boolean {
  return EPK_GOOGLE_FONTS.some((f) => f.family === family)
}