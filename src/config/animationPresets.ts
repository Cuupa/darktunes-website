/**
 * src/config/animationPresets.ts
 *
 * Framer Motion animation preset registry.
 *
 * Each preset defines the `initial`, `animate`, `exit`, and `transition`
 * objects consumed by Framer Motion's `motion.div` component.
 *
 * The active preset key is stored in `ThemeConfig.animation.preset` and
 * consumed by PageTransition to swap the variant set at runtime.
 */

import type { Variants, Transition } from 'framer-motion'

// ── Type ──────────────────────────────────────────────────────────────────────

export interface FramerAnimationPreset {
  variants: Variants
  transition: Transition
}

// ── Presets ───────────────────────────────────────────────────────────────────

/** Smooth opacity fade — the safest universal default. */
const fade: FramerAnimationPreset = {
  variants: {
    hidden:  { opacity: 0 },
    visible: { opacity: 1 },
    exit:    { opacity: 0 },
  },
  transition: { duration: 0.35, ease: 'easeInOut' },
}

/** Default — fade + gentle vertical slide (original darkTunes style). */
const slideUp: FramerAnimationPreset = {
  variants: {
    hidden:  { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: -8 },
  },
  transition: { type: 'spring', stiffness: 400, damping: 40, duration: 0.4 },
}

/** Scale-in from slightly smaller size. */
const scaleIn: FramerAnimationPreset = {
  variants: {
    hidden:  { opacity: 0, scale: 0.96 },
    visible: { opacity: 1, scale: 1 },
    exit:    { opacity: 0, scale: 1.02 },
  },
  transition: { type: 'spring', stiffness: 350, damping: 30 },
}

/** Horizontal slide — content enters from the right. */
const slideInRight: FramerAnimationPreset = {
  variants: {
    hidden:  { opacity: 0, x: 40 },
    visible: { opacity: 1, x: 0 },
    exit:    { opacity: 0, x: -40 },
  },
  transition: { type: 'spring', stiffness: 300, damping: 35 },
}

/**
 * Glitch-fade — rapid opacity stutter simulating a display glitch.
 * Uses `keyframes` array values supported by Framer Motion.
 */
const glitchFade: FramerAnimationPreset = {
  variants: {
    hidden:  { opacity: 0, x: 0 },
    visible: {
      opacity: [0, 1, 0.6, 1, 0.8, 1],
      x:       [0, -3, 3, -1, 1, 0],
    },
    exit: { opacity: 0, x: 4 },
  },
  transition: { duration: 0.45, ease: 'easeOut' },
}

/** Neon flicker — fast opacity pulses like a fluorescent sign warming up. */
const neonFlicker: FramerAnimationPreset = {
  variants: {
    hidden:  { opacity: 0 },
    visible: { opacity: [0, 0.4, 0, 0.7, 0.2, 1] },
    exit:    { opacity: [1, 0.3, 0.8, 0] },
  },
  transition: { duration: 0.5, ease: 'linear' },
}

/** Blur-in — content materialises from a blurred state. */
const blurIn: FramerAnimationPreset = {
  variants: {
    hidden:  { opacity: 0, filter: 'blur(12px)' },
    visible: { opacity: 1, filter: 'blur(0px)' },
    exit:    { opacity: 0, filter: 'blur(8px)' },
  },
  transition: { duration: 0.4, ease: 'easeOut' },
}

/** Wipe-up — content is revealed via a clip-path sweep. */
const wipeUp: FramerAnimationPreset = {
  variants: {
    hidden:  { opacity: 0, clipPath: 'inset(100% 0 0 0)' },
    visible: { opacity: 1, clipPath: 'inset(0% 0 0 0)' },
    exit:    { opacity: 0, clipPath: 'inset(0 0 100% 0)' },
  },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
}

/**
 * Graffiti tag — quick spray-paint entrance: clip sweeps left-to-right with
 * a slight skew and rotation. Good for HipHop themes.
 */
const graffitiTag: FramerAnimationPreset = {
  variants: {
    hidden:  { opacity: 0, x: -30, rotate: -3, clipPath: 'inset(0 100% 0 0)' },
    visible: { opacity: 1, x: 0,   rotate: 0,  clipPath: 'inset(0 0% 0 0)'   },
    exit:    { opacity: 0, x: 20,  rotate: 2 },
  },
  transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] },
}

/**
 * Heavy drop — content falls in from above with a heavy damped spring.
 * Good for Metal themes.
 */
const heavyDrop: FramerAnimationPreset = {
  variants: {
    hidden:  { opacity: 0, y: -40, scale: 1.04 },
    visible: { opacity: 1, y: 0,   scale: 1 },
    exit:    { opacity: 0, y: 20,  scale: 0.97 },
  },
  transition: { type: 'spring', stiffness: 280, damping: 18 },
}

/**
 * OS boot — rapid reveal in horizontal scanlines, like a CRT powering up.
 * Good for Cyberpunk / Future White themes.
 */
const osBoot: FramerAnimationPreset = {
  variants: {
    hidden:  { opacity: 0, filter: 'brightness(0) contrast(2)', scale: 1.01 },
    visible: {
      opacity: [0, 0.2, 0.8, 0.6, 1],
      filter:  ['brightness(0) contrast(2)', 'brightness(2) contrast(3)', 'brightness(1.5) contrast(2)', 'brightness(1) contrast(1.2)', 'brightness(1) contrast(1)'],
      scale: 1,
    },
    exit: { opacity: 0, filter: 'brightness(2) contrast(3)', scale: 0.99 },
  },
  transition: { duration: 0.55, ease: 'easeOut' },
}

/**
 * Synthwave glide — content slides up with a soft neon-inflected spring.
 * Wider initial travel to evoke VHS rewind / retro transitions.
 */
const synthwaveGlide: FramerAnimationPreset = {
  variants: {
    hidden:  { opacity: 0, y: 28, filter: 'blur(6px) saturate(2)' },
    visible: { opacity: 1, y: 0,  filter: 'blur(0px) saturate(1)' },
    exit:    { opacity: 0, y: -16, filter: 'blur(4px)' },
  },
  transition: { type: 'spring', stiffness: 220, damping: 30 },
}

/**
 * Clinical reveal — pixel-precise horizontal wipe with no blur, very clean.
 * Good for the Future White / Umbrella-Corp theme.
 */
const clinicalReveal: FramerAnimationPreset = {
  variants: {
    hidden:  { opacity: 0, x: -8, clipPath: 'inset(0 100% 0 0)' },
    visible: { opacity: 1, x: 0,  clipPath: 'inset(0 0% 0 0)'   },
    exit:    { opacity: 0, x: 4,  clipPath: 'inset(0 0 0 100%)'  },
  },
  transition: { duration: 0.38, ease: [0.4, 0, 0.2, 1] },
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const ANIMATION_PRESETS: Record<string, FramerAnimationPreset> = {
  fade,
  'slide-up':        slideUp,
  'scale-in':        scaleIn,
  'slide-in-right':  slideInRight,
  'glitch-fade':     glitchFade,
  'neon-flicker':    neonFlicker,
  'blur-in':         blurIn,
  'wipe-up':         wipeUp,
  'graffiti-tag':    graffitiTag,
  'heavy-drop':      heavyDrop,
  'os-boot':         osBoot,
  'synthwave-glide': synthwaveGlide,
  'clinical-reveal': clinicalReveal,
}

export const DEFAULT_ANIMATION_PRESET_KEY = 'slide-up'

/** Human-readable labels for the admin Animation preset picker. */
export const ANIMATION_PRESET_LABELS: Record<string, string> = {
  'fade':            'Fade',
  'slide-up':        'Slide Up (Default)',
  'scale-in':        'Scale In',
  'slide-in-right':  'Slide In Right',
  'glitch-fade':     'Glitch Fade',
  'neon-flicker':    'Neon Flicker',
  'blur-in':         'Blur In',
  'wipe-up':         'Wipe Up',
  'graffiti-tag':    'Graffiti Tag',
  'heavy-drop':      'Heavy Drop',
  'os-boot':         'OS Boot',
  'synthwave-glide': 'Synthwave Glide',
  'clinical-reveal': 'Clinical Reveal',
}

/**
 * Return the preset for the given key, falling back to the default slide-up
 * preset when the key is unknown or empty.
 */
export function getAnimationPreset(key: string | undefined): FramerAnimationPreset {
  return ANIMATION_PRESETS[key ?? DEFAULT_ANIMATION_PRESET_KEY] ?? ANIMATION_PRESETS[DEFAULT_ANIMATION_PRESET_KEY]
}
