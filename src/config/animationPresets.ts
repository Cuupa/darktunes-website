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

// ── Registry ──────────────────────────────────────────────────────────────────

export const ANIMATION_PRESETS: Record<string, FramerAnimationPreset> = {
  fade,
  'slide-up':      slideUp,
  'scale-in':      scaleIn,
  'slide-in-right': slideInRight,
  'glitch-fade':   glitchFade,
  'neon-flicker':  neonFlicker,
  'blur-in':       blurIn,
  'wipe-up':       wipeUp,
}

export const DEFAULT_ANIMATION_PRESET_KEY = 'slide-up'

/** Human-readable labels for the admin Animation preset picker. */
export const ANIMATION_PRESET_LABELS: Record<string, string> = {
  'fade':           'Fade',
  'slide-up':       'Slide Up (Default)',
  'scale-in':       'Scale In',
  'slide-in-right': 'Slide In Right',
  'glitch-fade':    'Glitch Fade',
  'neon-flicker':   'Neon Flicker',
  'blur-in':        'Blur In',
  'wipe-up':        'Wipe Up',
}

/**
 * Return the preset for the given key, falling back to the default slide-up
 * preset when the key is unknown or empty.
 */
export function getAnimationPreset(key: string | undefined): FramerAnimationPreset {
  return ANIMATION_PRESETS[key ?? DEFAULT_ANIMATION_PRESET_KEY] ?? ANIMATION_PRESETS[DEFAULT_ANIMATION_PRESET_KEY]
}
