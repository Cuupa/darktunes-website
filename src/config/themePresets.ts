/**
 * src/config/themePresets.ts
 *
 * Full-stack ThemeConfig preset registry — 20 general named themes plus 6
 * signature themes (DarkTunes, HipHop, Metal, Cyberpunk, Synthwave,
 * FutureWhite) that each carry a complete set of colors, gradients,
 * typography, glass, animation, AND effects.
 *
 * The existing COLOR_PRESETS in colorPresets.ts are kept as-is for backward
 * compatibility with the Colors tab of ColorThemeManager.
 */

import type { ThemeConfig, ThemeEffects } from '@/config/themeConfig'

// ── Helpers ───────────────────────────────────────────────────────────────────

function preset(
  colors: ThemeConfig['colors'],
  gradients: ThemeConfig['gradients'],
  typography: ThemeConfig['typography'],
  glass: ThemeConfig['glass'],
  animation: ThemeConfig['animation'],
  effects?: ThemeEffects,
  themeId?: string,
): ThemeConfig {
  return { colors, gradients, typography, glass, animation, effects, themeId }
}

// ── 20 Presets ────────────────────────────────────────────────────────────────

const darkTunesDefault: ThemeConfig = preset(
  { primary: '#a855f7', secondary: '#7c3aed', background: '#0a0a0f', foreground: '#f1f0ff', card: '#13111c', muted: '#1c1a2a', accent: '#c084fc', border: '#2d2a3e' },
  { heroFrom: '#1a0a2e', heroTo: '#0a0a0f', heroDir: '180deg', accentFrom: '#a855f7', accentTo: '#7c3aed', accentDir: '135deg' },
  { fontFamily: 'Inter', headingSize: '3rem' },
  { blur: '12px', opacity: '0.15' },
  { preset: 'slide-up', duration: '0.4s' },
)

const cyberpunk: ThemeConfig = preset(
  { primary: '#00ffff', secondary: '#ff00ff', background: '#050510', foreground: '#e0f7fa', card: '#0a0a1f', muted: '#0d0d24', accent: '#ff0090', border: '#1a1a3e' },
  { heroFrom: '#050510', heroTo: '#0a0030', heroDir: '135deg', accentFrom: '#00ffff', accentTo: '#ff00ff', accentDir: '90deg' },
  { fontFamily: 'Montserrat', headingSize: '3.5rem' },
  { blur: '16px', opacity: '0.12' },
  { preset: 'neon-flicker', duration: '0.5s' },
)

const bladeRunner: ThemeConfig = preset(
  { primary: '#ff6b00', secondary: '#cc4400', background: '#070501', foreground: '#ffe0b2', card: '#150d00', muted: '#1c1100', accent: '#ff9800', border: '#2d1c00' },
  { heroFrom: '#0d0800', heroTo: '#070501', heroDir: '180deg', accentFrom: '#ff6b00', accentTo: '#cc4400', accentDir: '135deg' },
  { fontFamily: 'Raleway', headingSize: '3rem' },
  { blur: '10px', opacity: '0.18' },
  { preset: 'blur-in', duration: '0.45s' },
)

const minimalMono: ThemeConfig = preset(
  { primary: '#ffffff', secondary: '#cccccc', background: '#000000', foreground: '#ffffff', card: '#111111', muted: '#1a1a1a', accent: '#ffffff', border: '#2a2a2a' },
  { heroFrom: '#111111', heroTo: '#000000', heroDir: '180deg', accentFrom: '#444', accentTo: '#111', accentDir: '135deg' },
  { fontFamily: 'DM Sans', headingSize: '2.75rem' },
  { blur: '8px', opacity: '0.1' },
  { preset: 'fade', duration: '0.3s' },
)

const industrialSteel: ThemeConfig = preset(
  { primary: '#9ca3af', secondary: '#6b7280', background: '#0f0f0f', foreground: '#e5e7eb', card: '#1a1a1a', muted: '#242424', accent: '#d1d5db', border: '#374151' },
  { heroFrom: '#0f0f0f', heroTo: '#1a1a2e', heroDir: '160deg', accentFrom: '#6b7280', accentTo: '#374151', accentDir: '135deg' },
  { fontFamily: 'Roboto', headingSize: '2.75rem' },
  { blur: '6px', opacity: '0.2' },
  { preset: 'slide-up', duration: '0.35s' },
)

const neonRave: ThemeConfig = preset(
  { primary: '#ff3cac', secondary: '#784ba0', background: '#0a0010', foreground: '#fff0ff', card: '#110020', muted: '#1a0030', accent: '#2b86c5', border: '#2a0050' },
  { heroFrom: '#0a0010', heroTo: '#150030', heroDir: '180deg', accentFrom: '#ff3cac', accentTo: '#2b86c5', accentDir: '135deg' },
  { fontFamily: 'Poppins', headingSize: '3.5rem' },
  { blur: '20px', opacity: '0.1' },
  { preset: 'neon-flicker', duration: '0.5s' },
)

const deepOcean: ThemeConfig = preset(
  { primary: '#06b6d4', secondary: '#0891b2', background: '#020c14', foreground: '#e0f7ff', card: '#041520', muted: '#071d2c', accent: '#67e8f9', border: '#0e3a50' },
  { heroFrom: '#020c14', heroTo: '#051e2e', heroDir: '180deg', accentFrom: '#06b6d4', accentTo: '#0891b2', accentDir: '135deg' },
  { fontFamily: 'Lato', headingSize: '3rem' },
  { blur: '14px', opacity: '0.15' },
  { preset: 'blur-in', duration: '0.4s' },
)

const bloodMoon: ThemeConfig = preset(
  { primary: '#dc2626', secondary: '#991b1b', background: '#0a0000', foreground: '#ffe4e4', card: '#150505', muted: '#1f0a0a', accent: '#ef4444', border: '#3d1010' },
  { heroFrom: '#0a0000', heroTo: '#1a0808', heroDir: '180deg', accentFrom: '#dc2626', accentTo: '#7f1d1d', accentDir: '135deg' },
  { fontFamily: 'Playfair Display', headingSize: '3.25rem' },
  { blur: '12px', opacity: '0.2' },
  { preset: 'glitch-fade', duration: '0.45s' },
)

const acidJazz: ThemeConfig = preset(
  { primary: '#facc15', secondary: '#f59e0b', background: '#050400', foreground: '#fffbeb', card: '#100d00', muted: '#1a1500', accent: '#fde68a', border: '#3d2e00' },
  { heroFrom: '#050400', heroTo: '#100d00', heroDir: '180deg', accentFrom: '#facc15', accentTo: '#f59e0b', accentDir: '90deg' },
  { fontFamily: 'Nunito', headingSize: '3rem' },
  { blur: '10px', opacity: '0.18' },
  { preset: 'scale-in', duration: '0.4s' },
)

const forestNight: ThemeConfig = preset(
  { primary: '#22c55e', secondary: '#16a34a', background: '#010a03', foreground: '#dcfce7', card: '#071208', muted: '#0f1e10', accent: '#4ade80', border: '#1a3a1d' },
  { heroFrom: '#010a03', heroTo: '#071208', heroDir: '180deg', accentFrom: '#22c55e', accentTo: '#16a34a', accentDir: '135deg' },
  { fontFamily: 'Open Sans', headingSize: '2.75rem' },
  { blur: '12px', opacity: '0.15' },
  { preset: 'wipe-up', duration: '0.45s' },
)

const arcticSnow: ThemeConfig = preset(
  { primary: '#3b82f6', secondary: '#2563eb', background: '#f8fafc', foreground: '#0f172a', card: '#f1f5f9', muted: '#e2e8f0', accent: '#60a5fa', border: '#cbd5e1' },
  { heroFrom: '#e0f2fe', heroTo: '#f8fafc', heroDir: '180deg', accentFrom: '#3b82f6', accentTo: '#2563eb', accentDir: '135deg' },
  { fontFamily: 'Inter', headingSize: '2.75rem' },
  { blur: '8px', opacity: '0.25' },
  { preset: 'fade', duration: '0.3s' },
)

const desertGold: ThemeConfig = preset(
  { primary: '#d97706', secondary: '#b45309', background: '#0c0800', foreground: '#fef3c7', card: '#1a1100', muted: '#251a00', accent: '#fbbf24', border: '#3d2e00' },
  { heroFrom: '#0c0800', heroTo: '#1a1100', heroDir: '180deg', accentFrom: '#d97706', accentTo: '#b45309', accentDir: '135deg' },
  { fontFamily: 'Raleway', headingSize: '3rem' },
  { blur: '10px', opacity: '0.2' },
  { preset: 'blur-in', duration: '0.4s' },
)

const vaporwave: ThemeConfig = preset(
  { primary: '#ff71ce', secondary: '#b967ff', background: '#01012b', foreground: '#fffaff', card: '#07073a', muted: '#0d0d45', accent: '#05ffa1', border: '#1e1e6e' },
  { heroFrom: '#01012b', heroTo: '#07073a', heroDir: '180deg', accentFrom: '#ff71ce', accentTo: '#05ffa1', accentDir: '135deg' },
  { fontFamily: 'Poppins', headingSize: '3.25rem' },
  { blur: '20px', opacity: '0.1' },
  { preset: 'neon-flicker', duration: '0.5s' },
)

const noirCinema: ThemeConfig = preset(
  { primary: '#d4af37', secondary: '#b8961e', background: '#0a0a0a', foreground: '#f5f5f0', card: '#141414', muted: '#1e1e1e', accent: '#d4af37', border: '#2a2a2a' },
  { heroFrom: '#0a0a0a', heroTo: '#141414', heroDir: '180deg', accentFrom: '#d4af37', accentTo: '#6b5900', accentDir: '135deg' },
  { fontFamily: 'Playfair Display', headingSize: '3.5rem' },
  { blur: '8px', opacity: '0.22' },
  { preset: 'fade', duration: '0.5s' },
)

const glitchCity: ThemeConfig = preset(
  { primary: '#00ff41', secondary: '#00cc33', background: '#000500', foreground: '#ccffcc', card: '#000d00', muted: '#001400', accent: '#ff0090', border: '#003300' },
  { heroFrom: '#000500', heroTo: '#000d00', heroDir: '180deg', accentFrom: '#00ff41', accentTo: '#ff0090', accentDir: '135deg' },
  { fontFamily: 'DM Sans', headingSize: '3rem' },
  { blur: '4px', opacity: '0.12' },
  { preset: 'glitch-fade', duration: '0.45s' },
)

const sunsetBoulevard: ThemeConfig = preset(
  { primary: '#f97316', secondary: '#ea580c', background: '#09040a', foreground: '#fff7f0', card: '#16060c', muted: '#200a12', accent: '#fb923c', border: '#3d1810' },
  { heroFrom: '#09040a', heroTo: '#16060c', heroDir: '160deg', accentFrom: '#f97316', accentTo: '#e11d48', accentDir: '135deg' },
  { fontFamily: 'Montserrat', headingSize: '3.25rem' },
  { blur: '14px', opacity: '0.18' },
  { preset: 'slide-in-right', duration: '0.4s' },
)

const purpleNight: ThemeConfig = preset(
  { primary: '#8b5cf6', secondary: '#7c3aed', background: '#050008', foreground: '#f3e8ff', card: '#0e0015', muted: '#150022', accent: '#a78bfa', border: '#2d1050' },
  { heroFrom: '#050008', heroTo: '#0e0015', heroDir: '180deg', accentFrom: '#8b5cf6', accentTo: '#ec4899', accentDir: '135deg' },
  { fontFamily: 'Inter', headingSize: '3rem' },
  { blur: '16px', opacity: '0.15' },
  { preset: 'blur-in', duration: '0.4s' },
)

const redEmber: ThemeConfig = preset(
  { primary: '#ef4444', secondary: '#b91c1c', background: '#080000', foreground: '#ffeded', card: '#120000', muted: '#1c0000', accent: '#fca5a5', border: '#3d0000' },
  { heroFrom: '#080000', heroTo: '#120000', heroDir: '180deg', accentFrom: '#ef4444', accentTo: '#7f1d1d', accentDir: '135deg' },
  { fontFamily: 'Roboto', headingSize: '3rem' },
  { blur: '12px', opacity: '0.2' },
  { preset: 'scale-in', duration: '0.4s' },
)

const midnightBlue: ThemeConfig = preset(
  { primary: '#6366f1', secondary: '#4f46e5', background: '#010118', foreground: '#eef2ff', card: '#07072a', muted: '#0d0d38', accent: '#818cf8', border: '#1e1e6e' },
  { heroFrom: '#010118', heroTo: '#07072a', heroDir: '180deg', accentFrom: '#6366f1', accentTo: '#4f46e5', accentDir: '135deg' },
  { fontFamily: 'Nunito', headingSize: '3rem' },
  { blur: '14px', opacity: '0.15' },
  { preset: 'slide-up', duration: '0.4s' },
)

const chromeAndBone: ThemeConfig = preset(
  { primary: '#a8a29e', secondary: '#78716c', background: '#0a0908', foreground: '#f5f0eb', card: '#161310', muted: '#211d19', accent: '#d6d3d1', border: '#3a3330' },
  { heroFrom: '#0a0908', heroTo: '#161310', heroDir: '180deg', accentFrom: '#a8a29e', accentTo: '#57534e', accentDir: '135deg' },
  { fontFamily: 'DM Sans', headingSize: '2.75rem' },
  { blur: '8px', opacity: '0.22' },
  { preset: 'wipe-up', duration: '0.45s' },
)

// ── Registry ──────────────────────────────────────────────────────────────────

export const THEME_PRESETS: Record<string, ThemeConfig> = {
  'darktunes-default':  darkTunesDefault,
  'cyberpunk':          cyberpunk,
  'blade-runner':       bladeRunner,
  'minimal-mono':       minimalMono,
  'industrial-steel':   industrialSteel,
  'neon-rave':          neonRave,
  'deep-ocean':         deepOcean,
  'blood-moon':         bloodMoon,
  'acid-jazz':          acidJazz,
  'forest-night':       forestNight,
  'arctic-snow':        arcticSnow,
  'desert-gold':        desertGold,
  'vaporwave':          vaporwave,
  'noir-cinema':        noirCinema,
  'glitch-city':        glitchCity,
  'sunset-boulevard':   sunsetBoulevard,
  'purple-night':       purpleNight,
  'red-ember':          redEmber,
  'midnight-blue':      midnightBlue,
  'chrome-and-bone':    chromeAndBone,
}

/** Human-readable display names for the admin preset picker. */
export const THEME_PRESET_LABELS: Record<string, string> = {
  'darktunes-default':  'DarkTunes Default',
  'cyberpunk':          'Cyberpunk',
  'blade-runner':       'Blade Runner',
  'minimal-mono':       'Minimal Mono',
  'industrial-steel':   'Industrial Steel',
  'neon-rave':          'Neon Rave',
  'deep-ocean':         'Deep Ocean',
  'blood-moon':         'Blood Moon',
  'acid-jazz':          'Acid Jazz',
  'forest-night':       'Forest Night',
  'arctic-snow':        'Arctic Snow',
  'desert-gold':        'Desert Gold',
  'vaporwave':          'Vaporwave',
  'noir-cinema':        'Noir Cinema',
  'glitch-city':        'Glitch City',
  'sunset-boulevard':   'Sunset Boulevard',
  'purple-night':       'Purple Night',
  'red-ember':          'Red Ember',
  'midnight-blue':      'Midnight Blue',
  'chrome-and-bone':    'Chrome & Bone',
}

// ── 6 Signature Themes ────────────────────────────────────────────────────────
// Each carries a full set including effects, typography, animation & themeId.

/**
 * DarkTunes — The brand default.  Deep purple, smooth, premium.
 * Signature effects: subtle grain, vignette, hover glow, heading shimmer.
 */
const signatureDarkTunes: ThemeConfig = preset(
  { primary: '#a855f7', secondary: '#7c3aed', background: '#0a0a0f', foreground: '#f1f0ff', card: '#13111c', muted: '#1c1a2a', accent: '#c084fc', border: '#2d2a3e' },
  { heroFrom: '#1a0a2e', heroTo: '#0a0a0f', heroDir: '180deg', accentFrom: '#a855f7', accentTo: '#7c3aed', accentDir: '135deg' },
  { fontFamily: 'Inter', headingFamily: 'Inter', headingSize: '3rem', bodySize: '1rem', bodyWeight: '400', headingWeight: '700', lineHeight: '1.6', letterSpacing: '0em' },
  { blur: '12px', opacity: '0.15' },
  { preset: 'slide-up', duration: '0.4s' },
  {
    overlay: { noiseOpacity: 0.04, crtEnabled: false, vignetteIntensity: 0.45 },
    hover: { imageHoverZoom: { enabled: true, scale: 1.05 }, imageHoverGlow: { enabled: true, color: '#a855f7', blur: 24 }, cardHoverLift: { enabled: true, intensity: 20 } },
    text: { headingGlow: { enabled: false, color: '#a855f7', blur: 16 }, textShimmer: { enabled: false } },
    ui: { scrollReveal: { enabled: true }, buttonRipple: { enabled: true }, borderPulse: { enabled: false, speed: 2.5 } },
  },
  'sig-darktunes',
)

/**
 * HipHop — Raw street energy.  Graffiti spray-paint transitions, bold typewriter
 * font, high-contrast warm palette with splashes of gold.
 */
const signatureHipHop: ThemeConfig = preset(
  { primary: '#f59e0b', secondary: '#ef4444', background: '#0a0500', foreground: '#fff8e1', card: '#160d00', muted: '#231200', accent: '#fbbf24', border: '#3d2000' },
  { heroFrom: '#0a0500', heroTo: '#1a0900', heroDir: '180deg', accentFrom: '#f59e0b', accentTo: '#ef4444', accentDir: '135deg' },
  { fontFamily: 'Bebas Neue', headingFamily: 'Bebas Neue', headingSize: '4rem', bodySize: '1rem', bodyWeight: '400', headingWeight: '400', lineHeight: '1.4', letterSpacing: '0.02em' },
  { blur: '6px', opacity: '0.2' },
  { preset: 'graffiti-tag', duration: '0.55s' },
  {
    overlay: { noiseOpacity: 0.06, crtEnabled: false, vignetteIntensity: 0.6 },
    hover: { imageHoverZoom: { enabled: true, scale: 1.08 }, imageHoverTilt: { enabled: true }, cardHoverScale: { enabled: true, scale: 1.04 } },
    text: { headingGlow: { enabled: false, color: '#f59e0b', blur: 0 }, textShimmer: { enabled: false } },
    ui: { scrollReveal: { enabled: true }, buttonRipple: { enabled: true }, borderPulse: { enabled: false, speed: 2.5 } },
  },
  'sig-hiphop',
)

/**
 * Metal — Dark, heavy, distorted.  Metallic silver-black, brutal typography,
 * heavy drop transitions, high vignette.
 */
const signatureMetal: ThemeConfig = preset(
  { primary: '#9ca3af', secondary: '#6b7280', background: '#050505', foreground: '#e8e8e8', card: '#0f0f0f', muted: '#1a1a1a', accent: '#d1d5db', border: '#2a2a2a' },
  { heroFrom: '#050505', heroTo: '#0f0f0f', heroDir: '180deg', accentFrom: '#6b7280', accentTo: '#374151', accentDir: '135deg' },
  { fontFamily: 'Oswald', headingFamily: 'Oswald', headingSize: '3.5rem', bodySize: '1rem', bodyWeight: '400', headingWeight: '700', lineHeight: '1.45', letterSpacing: '0.01em' },
  { blur: '4px', opacity: '0.25' },
  { preset: 'heavy-drop', duration: '0.5s' },
  {
    overlay: { noiseOpacity: 0.08, crtEnabled: false, vignetteIntensity: 0.75 },
    hover: { imageHoverZoom: { enabled: true, scale: 1.04 }, cardHoverLift: { enabled: true, intensity: 30 }, imageHoverGlow: { enabled: true, color: '#6b7280', blur: 20 } },
    text: { headingGlow: { enabled: false, color: '#9ca3af', blur: 8 }, textShimmer: { enabled: false } },
    ui: { scrollReveal: { enabled: true }, buttonRipple: { enabled: false }, borderPulse: { enabled: false, speed: 2.5 } },
  },
  'sig-metal',
)

/**
 * Cyberpunk — Glitchy OS aesthetic.  Cyan / magenta on near-black, fine
 * geometry, OS-boot page transitions, chromatic aberration, CRT scanlines.
 */
const signatureCyberpunk: ThemeConfig = preset(
  { primary: '#00ffff', secondary: '#ff00ff', background: '#040408', foreground: '#e0f7fa', card: '#080814', muted: '#0d0d20', accent: '#ff0090', border: '#1a1a3e' },
  { heroFrom: '#040408', heroTo: '#0a0030', heroDir: '135deg', accentFrom: '#00ffff', accentTo: '#ff00ff', accentDir: '90deg' },
  { fontFamily: 'Share Tech Mono', headingFamily: 'Orbitron', headingSize: '3rem', bodySize: '0.95rem', bodyWeight: '400', headingWeight: '700', lineHeight: '1.7', letterSpacing: '0.03em' },
  { blur: '16px', opacity: '0.12' },
  { preset: 'os-boot', duration: '0.55s' },
  {
    overlay: { noiseOpacity: 0.03, crtEnabled: true, vignetteIntensity: 0.55, chromaticAberration: { enabled: true, intensity: 2 } },
    hover: { imageHoverZoom: { enabled: true, scale: 1.04 }, imageHoverGlow: { enabled: true, color: '#00ffff', blur: 32 }, cardHoverScale: { enabled: true, scale: 1.03 } },
    text: { headingGlow: { enabled: true, color: '#00ffff', blur: 12 }, textShimmer: { enabled: false } },
    ui: { scrollReveal: { enabled: true }, buttonRipple: { enabled: true }, borderPulse: { enabled: true, speed: 2 } },
  },
  'sig-cyberpunk',
)

/**
 * Synthwave — Purple-neon retro-future.  Soft chromatic aberration, saturated
 * gradients, warm glow, smooth synthwave-glide transitions.
 */
const signatureSynthwave: ThemeConfig = preset(
  { primary: '#d946ef', secondary: '#7c3aed', background: '#0d0015', foreground: '#fff0ff', card: '#160025', muted: '#1f0035', accent: '#f0abfc', border: '#3b0070' },
  { heroFrom: '#0d0015', heroTo: '#1a003a', heroDir: '180deg', accentFrom: '#d946ef', accentTo: '#7c3aed', accentDir: '135deg' },
  { fontFamily: 'Nunito', headingFamily: 'Comfortaa', headingSize: '3.25rem', bodySize: '1rem', bodyWeight: '400', headingWeight: '700', lineHeight: '1.65', letterSpacing: '0.01em' },
  { blur: '20px', opacity: '0.1' },
  { preset: 'synthwave-glide', duration: '0.5s' },
  {
    overlay: { noiseOpacity: 0.035, crtEnabled: false, vignetteIntensity: 0.5, chromaticAberration: { enabled: true, intensity: 1.5 }, colorWash: { enabled: true, color: '#7c3aed', opacity: 0.05 } },
    hover: { imageHoverZoom: { enabled: true, scale: 1.06 }, imageHoverGlow: { enabled: true, color: '#d946ef', blur: 36 }, cardHoverLift: { enabled: true, intensity: 24 } },
    text: { headingGlow: { enabled: true, color: '#d946ef', blur: 20 }, textShimmer: { enabled: true } },
    ui: { scrollReveal: { enabled: true }, buttonRipple: { enabled: true }, borderPulse: { enabled: true, speed: 3 } },
  },
  'sig-synthwave',
)

/**
 * Future White Clinical — Cold, precise, Umbrella-Corp OS aesthetic.
 * Near-white with fine geometric lines, clinical reveal animations,
 * subtle chromatic aberration, minimal effects.
 */
const signatureFutureWhite: ThemeConfig = preset(
  { primary: '#0ea5e9', secondary: '#0369a1', background: '#f8fafc', foreground: '#0f172a', card: '#ffffff', muted: '#f1f5f9', accent: '#38bdf8', border: '#e2e8f0' },
  { heroFrom: '#f0f9ff', heroTo: '#f8fafc', heroDir: '180deg', accentFrom: '#0ea5e9', accentTo: '#0369a1', accentDir: '135deg' },
  { fontFamily: 'DM Sans', headingFamily: 'Space Grotesk', headingSize: '2.75rem', bodySize: '0.95rem', bodyWeight: '400', headingWeight: '600', lineHeight: '1.55', letterSpacing: '0.005em' },
  { blur: '8px', opacity: '0.3' },
  { preset: 'clinical-reveal', duration: '0.38s' },
  {
    overlay: { noiseOpacity: 0.01, crtEnabled: false, vignetteIntensity: 0.1, chromaticAberration: { enabled: true, intensity: 0.8 } },
    hover: { imageHoverZoom: { enabled: true, scale: 1.03 }, cardHoverLift: { enabled: true, intensity: 12 }, imageHoverGlow: { enabled: false, color: '#0ea5e9', blur: 16 } },
    text: { headingGlow: { enabled: false, color: '#0ea5e9', blur: 0 }, textShimmer: { enabled: false } },
    ui: { scrollReveal: { enabled: true }, buttonRipple: { enabled: true }, borderPulse: { enabled: false, speed: 2.5 } },
  },
  'sig-futurewhite',
)

// ── Signature theme registries ────────────────────────────────────────────────

export const SIGNATURE_THEMES: Record<string, ThemeConfig> = {
  'sig-darktunes':   signatureDarkTunes,
  'sig-hiphop':      signatureHipHop,
  'sig-metal':       signatureMetal,
  'sig-cyberpunk':   signatureCyberpunk,
  'sig-synthwave':   signatureSynthwave,
  'sig-futurewhite': signatureFutureWhite,
}

export const SIGNATURE_THEME_META: Record<string, { label: string; description: string; emoji: string }> = {
  'sig-darktunes': {
    label: 'DarkTunes',
    description: 'Deep purple brand identity — smooth, premium, atmospheric.',
    emoji: '🎵',
  },
  'sig-hiphop': {
    label: 'HipHop',
    description: 'Raw street energy — graffiti spray transitions, bold typewriter fonts, gold & red palette.',
    emoji: '🎤',
  },
  'sig-metal': {
    label: 'Metal',
    description: 'Dark, brutal, metallic — heavy drop transitions, high vignette, silver-on-black.',
    emoji: '🤘',
  },
  'sig-cyberpunk': {
    label: 'Cyberpunk',
    description: 'Glitchy OS aesthetic — CRT scanlines, chromatic aberration, OS-boot animations, cyan/magenta.',
    emoji: '🤖',
  },
  'sig-synthwave': {
    label: 'Synthwave',
    description: 'Retro-future purple — chromatic aberration, neon glow, heading shimmer, silky transitions.',
    emoji: '🌆',
  },
  'sig-futurewhite': {
    label: 'Future White',
    description: 'Clinical precision — Umbrella-Corp OS aesthetic, fine geometry, clean white with electric blue.',
    emoji: '🧬',
  },
}
