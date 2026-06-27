/**
 * src/lib/epk/gradients.ts
 *
 * Shared linear-gradient model for Konva canvas + PDF export.
 */

export interface EpkGradientStop {
  offset: number
  color: string
}

export interface EpkGradient {
  angle: number
  stops: EpkGradientStop[]
}

export interface EpkGradientPreset {
  id: string
  name: string
  gradient: EpkGradient
}

export const DEFAULT_GRADIENT_ANGLE = 135

export const EPK_GRADIENT_PRESETS: EpkGradientPreset[] = [
  {
    id: 'purple-dusk',
    name: 'Purple Dusk',
    gradient: {
      angle: 135,
      stops: [
        { offset: 0, color: '#0a0f1a' },
        { offset: 0.55, color: '#1a1530' },
        { offset: 1, color: '#493687' },
      ],
    },
  },
  {
    id: 'neon-pulse',
    name: 'Neon Pulse',
    gradient: {
      angle: 120,
      stops: [
        { offset: 0, color: '#080810' },
        { offset: 0.45, color: '#493687' },
        { offset: 1, color: '#7e1e37' },
      ],
    },
  },
  {
    id: 'sunset-glow',
    name: 'Sunset Glow',
    gradient: {
      angle: 160,
      stops: [
        { offset: 0, color: '#120808' },
        { offset: 0.5, color: '#7e1e37' },
        { offset: 1, color: '#493687' },
      ],
    },
  },
  {
    id: 'midnight-blue',
    name: 'Midnight Blue',
    gradient: {
      angle: 180,
      stops: [
        { offset: 0, color: '#101010' },
        { offset: 1, color: '#1a1530' },
      ],
    },
  },
  {
    id: 'arctic-fade',
    name: 'Arctic Fade',
    gradient: {
      angle: 90,
      stops: [
        { offset: 0, color: '#f4f6f8' },
        { offset: 1, color: '#e8ecf0' },
      ],
    },
  },
  {
    id: 'gold-luxe',
    name: 'Gold Luxe',
    gradient: {
      angle: 45,
      stops: [
        { offset: 0, color: '#0c0a08' },
        { offset: 0.6, color: '#1a1610' },
        { offset: 1, color: '#493687' },
      ],
    },
  },
]

const presetById = new Map(EPK_GRADIENT_PRESETS.map((p) => [p.id, p]))

export function getEpkGradientPreset(id: string): EpkGradientPreset | undefined {
  return presetById.get(id)
}

export function normalizeGradientStops(stops: EpkGradientStop[]): EpkGradientStop[] {
  if (stops.length === 0) {
    return [
      { offset: 0, color: '#101010' },
      { offset: 1, color: '#493687' },
    ]
  }
  return [...stops]
    .sort((a, b) => a.offset - b.offset)
    .map((stop) => ({
      offset: Math.max(0, Math.min(1, stop.offset)),
      color: stop.color,
    }))
}

export function gradientEndpoints(
  width: number,
  height: number,
  angleDeg: number,
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  const cx = width / 2
  const cy = height / 2
  const len = Math.sqrt(width * width + height * height) / 2
  return {
    start: { x: cx - Math.cos(rad) * len, y: cy - Math.sin(rad) * len },
    end: { x: cx + Math.cos(rad) * len, y: cy + Math.sin(rad) * len },
  }
}

export function gradientToKonvaColorStops(stops: EpkGradientStop[]): (number | string)[] {
  const normalized = normalizeGradientStops(stops)
  const flat: (number | string)[] = []
  for (const stop of normalized) {
    flat.push(stop.offset, stop.color)
  }
  return flat
}

export function gradientToKonvaProps(
  width: number,
  height: number,
  gradient: EpkGradient,
): {
  fillLinearGradientStartPoint: { x: number; y: number }
  fillLinearGradientEndPoint: { x: number; y: number }
  fillLinearGradientColorStops: (number | string)[]
} {
  const { start, end } = gradientEndpoints(width, height, gradient.angle ?? DEFAULT_GRADIENT_ANGLE)
  return {
    fillLinearGradientStartPoint: start,
    fillLinearGradientEndPoint: end,
    fillLinearGradientColorStops: gradientToKonvaColorStops(gradient.stops),
  }
}

/** SVG linearGradient vector from angle (matches Konva endpoints). */
function svgGradientVector(angleDeg: number): { x1: string; y1: string; x2: string; y2: string } {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  const x = Math.cos(rad)
  const y = Math.sin(rad)
  return {
    x1: `${50 - x * 50}%`,
    y1: `${50 - y * 50}%`,
    x2: `${50 + x * 50}%`,
    y2: `${50 + y * 50}%`,
  }
}

export function gradientToSvg(
  width: number,
  height: number,
  gradient: EpkGradient,
  id = 'epk-grad',
): string {
  const stops = normalizeGradientStops(gradient.stops)
  const vec = svgGradientVector(gradient.angle ?? DEFAULT_GRADIENT_ANGLE)
  const stopTags = stops
    .map((s) => `<stop offset="${Math.round(s.offset * 100)}%" stop-color="${s.color}"/>`)
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="${id}" x1="${vec.x1}" y1="${vec.y1}" x2="${vec.x2}" y2="${vec.y2}">
      ${stopTags}
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#${id})"/>
</svg>`
}

export function parseGradientFromBackground(background: {
  type: string
  gradientStops?: EpkGradientStop[]
  gradientAngle?: number
}): EpkGradient | null {
  if (background.type !== 'gradient' || !background.gradientStops?.length) return null
  return {
    angle: background.gradientAngle ?? DEFAULT_GRADIENT_ANGLE,
    stops: background.gradientStops,
  }
}

export function parseGradientFromStyle(style: {
  fillType?: string
  gradientStops?: EpkGradientStop[]
  gradientAngle?: number
}): EpkGradient | null {
  if (style.fillType !== 'gradient' || !style.gradientStops?.length) return null
  return {
    angle: style.gradientAngle ?? DEFAULT_GRADIENT_ANGLE,
    stops: style.gradientStops,
  }
}