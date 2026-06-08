/**
 * src/config/effectDescriptors.ts
 *
 * Rich metadata registry for all configurable visual effects.
 *
 * Each descriptor carries:
 *  - id        : unique key matching the ThemeEffects property path
 *  - category  : used to group effects in the admin UI
 *  - label     : human-readable short name
 *  - description: one-line explanation shown under the control
 *  - icon      : Phosphor icon name (string) for the row icon
 *  - params    : zero or more numeric / boolean / color params with defaults
 *
 * The admin EffectsTab component iterates this list to render controls
 * automatically — adding a new effect only requires an entry here and the
 * corresponding CSS/TS plumbing.
 */

export type EffectParamType = 'number' | 'boolean' | 'color'

export interface EffectParam {
  key: string
  label: string
  type: EffectParamType
  defaultValue: number | boolean | string
  min?: number
  max?: number
  step?: number
  hint?: string
}

export type EffectCategory = 'overlay' | 'hover' | 'text' | 'ui' | 'transition'

export interface EffectDescriptor {
  /** Unique effect identifier (maps to ThemeEffects path, e.g. "overlay.noiseOpacity") */
  id: string
  category: EffectCategory
  label: string
  description: string
  /** Phosphor icon component name */
  icon: string
  /** When true, the effect has a dedicated `enabled` boolean param. */
  toggleable: boolean
  params: EffectParam[]
}

// ── Overlay effects ───────────────────────────────────────────────────────────

const filmGrain: EffectDescriptor = {
  id: 'overlay.noiseOpacity',
  category: 'overlay',
  label: 'Film Grain / Noise',
  description: 'Animated noise texture overlay. 0 = none, 0.15 = heavy grain.',
  icon: 'FilmStrip',
  toggleable: false,
  params: [
    { key: 'noiseOpacity', label: 'Intensity', type: 'number', defaultValue: 0.04, min: 0, max: 0.15, step: 0.005, hint: '0 = off · 0.15 = heavy' },
  ],
}

const crtScanlines: EffectDescriptor = {
  id: 'overlay.crtEnabled',
  category: 'overlay',
  label: 'CRT Scanlines',
  description: 'Animated horizontal scanline overlay — retro CRT monitor effect.',
  icon: 'Monitor',
  toggleable: true,
  params: [],
}

const vignette: EffectDescriptor = {
  id: 'overlay.vignetteIntensity',
  category: 'overlay',
  label: 'Vignette',
  description: 'Darkened edges that focus attention on the centre.',
  icon: 'Sun',
  toggleable: false,
  params: [
    { key: 'vignetteIntensity', label: 'Intensity', type: 'number', defaultValue: 0.5, min: 0, max: 1, step: 0.05, hint: '0 = none · 1 = strong' },
  ],
}

const chromaticAberration: EffectDescriptor = {
  id: 'overlay.chromaticAberration',
  category: 'overlay',
  label: 'Chromatic Aberration',
  description: 'RGB channel fringing on edges — cyberpunk / lo-fi lens effect.',
  icon: 'Aperture',
  toggleable: true,
  params: [
    { key: 'intensity', label: 'Offset (px)', type: 'number', defaultValue: 2, min: 0.5, max: 6, step: 0.5, hint: 'Pixel offset per channel' },
  ],
}

const colorWash: EffectDescriptor = {
  id: 'overlay.colorWash',
  category: 'overlay',
  label: 'Colour Wash',
  description: 'Subtle tinted overlay across the whole page.',
  icon: 'PaintBucket',
  toggleable: true,
  params: [
    { key: 'color', label: 'Colour', type: 'color', defaultValue: '#6600ff' },
    { key: 'opacity', label: 'Opacity', type: 'number', defaultValue: 0.08, min: 0.01, max: 0.3, step: 0.01 },
  ],
}

// ── Hover / image effects ─────────────────────────────────────────────────────

const imageHoverZoom: EffectDescriptor = {
  id: 'hover.imageHoverZoom',
  category: 'hover',
  label: 'Image Hover Zoom',
  description: 'Images gently scale up when hovered.',
  icon: 'MagnifyingGlassPlus',
  toggleable: true,
  params: [
    { key: 'scale', label: 'Scale', type: 'number', defaultValue: 1.05, min: 1.01, max: 1.2, step: 0.01, hint: '1.05 = 5 % zoom' },
  ],
}

const imageHoverTilt: EffectDescriptor = {
  id: 'hover.imageHoverTilt',
  category: 'hover',
  label: 'Image 3D Tilt',
  description: 'Subtle 3-D perspective tilt on image hover.',
  icon: 'ArrowsOut',
  toggleable: true,
  params: [],
}

const imageHoverGlow: EffectDescriptor = {
  id: 'hover.imageHoverGlow',
  category: 'hover',
  label: 'Image Hover Glow',
  description: 'Coloured glow behind images on hover.',
  icon: 'Sparkle',
  toggleable: true,
  params: [
    { key: 'color', label: 'Glow Colour', type: 'color', defaultValue: '#a855f7' },
    { key: 'blur', label: 'Blur (px)', type: 'number', defaultValue: 24, min: 4, max: 60, step: 2 },
  ],
}

const cardHoverScale: EffectDescriptor = {
  id: 'hover.cardHoverScale',
  category: 'hover',
  label: 'Card Hover Scale',
  description: 'Cards scale up slightly on hover.',
  icon: 'FrameCorners',
  toggleable: true,
  params: [
    { key: 'scale', label: 'Scale', type: 'number', defaultValue: 1.03, min: 1.01, max: 1.1, step: 0.005 },
  ],
}

const cardHoverLift: EffectDescriptor = {
  id: 'hover.cardHoverLift',
  category: 'hover',
  label: 'Card Hover Lift',
  description: 'Elevated drop-shadow on card hover — gives a 3-D lifted feel.',
  icon: 'Stack',
  toggleable: true,
  params: [
    { key: 'intensity', label: 'Shadow Depth', type: 'number', defaultValue: 24, min: 4, max: 60, step: 2 },
  ],
}

// ── Text effects ──────────────────────────────────────────────────────────────

const headingGlow: EffectDescriptor = {
  id: 'text.headingGlow',
  category: 'text',
  label: 'Heading Glow',
  description: 'Neon glow on h1/h2 elements.',
  icon: 'TextHOne',
  toggleable: true,
  params: [
    { key: 'color', label: 'Glow Colour', type: 'color', defaultValue: '#a855f7' },
    { key: 'blur', label: 'Blur (px)', type: 'number', defaultValue: 16, min: 2, max: 48, step: 2 },
  ],
}

const textShimmer: EffectDescriptor = {
  id: 'text.textShimmer',
  category: 'text',
  label: 'Heading Shimmer',
  description: 'Animated gradient shimmer sweeps across heading text.',
  icon: 'Sparkle',
  toggleable: true,
  params: [],
}

// ── UI effects ────────────────────────────────────────────────────────────────

const borderPulse: EffectDescriptor = {
  id: 'ui.borderPulse',
  category: 'ui',
  label: 'Border Pulse',
  description: 'Subtle pulsing glow on interactive element borders.',
  icon: 'Pulse',
  toggleable: true,
  params: [
    { key: 'speed', label: 'Speed (s)', type: 'number', defaultValue: 2.5, min: 0.5, max: 6, step: 0.25, hint: 'Cycle duration in seconds' },
  ],
}

const buttonRipple: EffectDescriptor = {
  id: 'ui.buttonRipple',
  category: 'ui',
  label: 'Button Ripple',
  description: 'Material-style ripple animation when buttons are clicked.',
  icon: 'CircleDashed',
  toggleable: true,
  params: [],
}

const scrollReveal: EffectDescriptor = {
  id: 'ui.scrollReveal',
  category: 'ui',
  label: 'Scroll Reveal',
  description: 'Page sections fade in as they enter the viewport.',
  icon: 'ArrowDown',
  toggleable: true,
  params: [],
}

// ── Transition effects ────────────────────────────────────────────────────────

const pageTransitionBlur: EffectDescriptor = {
  id: 'transition.pageBlur',
  category: 'transition',
  label: 'Page-Exit Blur',
  description: 'Pages blur out when navigating away — smoother than hard cuts.',
  icon: 'NavigationArrow',
  toggleable: true,
  params: [],
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const EFFECT_DESCRIPTORS: EffectDescriptor[] = [
  // Overlay
  filmGrain,
  crtScanlines,
  vignette,
  chromaticAberration,
  colorWash,
  // Hover
  imageHoverZoom,
  imageHoverTilt,
  imageHoverGlow,
  cardHoverScale,
  cardHoverLift,
  // Text
  headingGlow,
  textShimmer,
  // UI
  borderPulse,
  buttonRipple,
  scrollReveal,
  // Transition
  pageTransitionBlur,
]

export const EFFECT_CATEGORY_LABELS: Record<EffectCategory, string> = {
  overlay:    'Overlay',
  hover:      'Image & Card Hover',
  text:       'Text',
  ui:         'UI',
  transition: 'Transitions',
}

/** Look up a descriptor by id.  Returns undefined when not found. */
export function getEffectDescriptor(id: string): EffectDescriptor | undefined {
  return EFFECT_DESCRIPTORS.find((d) => d.id === id)
}

/** Return all descriptors for a given category. */
export function getEffectsByCategory(category: EffectCategory): EffectDescriptor[] {
  return EFFECT_DESCRIPTORS.filter((d) => d.category === category)
}
