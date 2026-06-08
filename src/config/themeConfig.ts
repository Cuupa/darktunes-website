/**
 * src/config/themeConfig.ts
 *
 * Canonical ThemeConfig TypeScript interface for the dynamic theme engine.
 *
 * Every visual property in the system maps to a CSS custom property (design
 * token).  Admins set these values in the admin Color Theme panel; they are
 * written to the `site_settings` table as a single `theme_config` JSON blob
 * and injected server-side via ThemeStyleInjector so there is no FOUC.
 *
 * CSS token map:
 *   colors.primary       → --primary
 *   colors.secondary     → --secondary
 *   colors.background    → --background
 *   colors.foreground    → --foreground
 *   colors.card          → --card
 *   colors.muted         → --muted
 *   colors.accent        → --accent
 *   colors.border        → --border
 *   gradients.heroFrom/heroTo/heroDir  → --gradient-hero   (computed)
 *   gradients.accentFrom/accentTo/accentDir → --gradient-accent (computed)
 *   typography.fontFamily    → --font-family-body
 *   typography.headingFamily → --font-family-heading
 *   typography.headingSize   → --heading-size
 *   typography.bodySize      → --body-size
 *   typography.bodyWeight    → --body-weight
 *   typography.headingWeight → --heading-weight
 *   typography.lineHeight    → --line-height-body
 *   typography.letterSpacing → --letter-spacing-body
 *   glass.blur           → --glass-blur
 *   glass.opacity        → --glass-opacity
 *   animation.duration   → --animation-duration
 *   animation.preset     → consumed by PageTransition / animationPresets
 *   effects.*            → --fx-* CSS custom properties + data-fx-* on <html>
 */

// ── Sub-types ─────────────────────────────────────────────────────────────────

export interface ThemeColors {
  /** Main brand / interactive colour.  CSS: --primary */
  primary: string
  /** Secondary brand colour.  CSS: --secondary */
  secondary: string
  /** Page / body background.  CSS: --background */
  background: string
  /** Default body text colour.  CSS: --foreground */
  foreground: string
  /** Card / surface colour.  CSS: --card */
  card: string
  /** Muted / subtle surface colour.  CSS: --muted */
  muted: string
  /** Accent / highlight colour.  CSS: --accent */
  accent: string
  /** Border colour.  CSS: --border */
  border: string
}

export interface ThemeGradients {
  /** Hero gradient start colour */
  heroFrom?: string
  /** Hero gradient end colour */
  heroTo?: string
  /** Hero gradient direction (CSS angle or keyword, e.g. "135deg" or "to right") */
  heroDir?: string
  /** Accent gradient start colour */
  accentFrom?: string
  /** Accent gradient end colour */
  accentTo?: string
  /** Accent gradient direction */
  accentDir?: string
}

export interface ThemeTypography {
  /**
   * Body font-family string, e.g. "Inter".
   * When set to a known Google Font name, ThemeStyleInjector injects a <link> tag.
   * CSS token: --font-family-body
   */
  fontFamily?: string
  /**
   * Separate heading font-family (e.g. "Oswald").  Falls back to fontFamily.
   * CSS token: --font-family-heading
   */
  headingFamily?: string
  /**
   * Base heading (h1) size, e.g. "3rem".
   * CSS token: --heading-size
   */
  headingSize?: string
  /**
   * Body base font size, e.g. "1rem" or "16px".
   * CSS token: --body-size
   */
  bodySize?: string
  /**
   * Body font weight, e.g. "400".
   * CSS token: --body-weight
   */
  bodyWeight?: string
  /**
   * Heading font weight, e.g. "700".
   * CSS token: --heading-weight
   */
  headingWeight?: string
  /**
   * Body line-height, e.g. "1.6".
   * CSS token: --line-height-body
   */
  lineHeight?: string
  /**
   * Body letter-spacing, e.g. "0.01em".
   * CSS token: --letter-spacing-body
   */
  letterSpacing?: string
}

// ── Effects ───────────────────────────────────────────────────────────────────

/**
 * Overlay effects — rendered by VisualEffectsOverlay as a single fixed layer.
 * Disabled effects consume zero GPU/CPU resources (CSS vars at neutral values).
 */
export interface OverlayEffects {
  /** Film grain / noise intensity 0–0.15.  CSS: --fx-noise-opacity */
  noiseOpacity?: number
  /** CRT horizontal scanlines.  data-fx-crt on <html> */
  crtEnabled?: boolean
  /** Vignette darkened edges 0–1.  CSS: --fx-vignette */
  vignetteIntensity?: number
  /** Chromatic colour fringing offset 0–6 (px).  CSS: --fx-chromatic-offset */
  chromaticAberration?: { enabled: boolean; intensity: number }
  /** Colour wash overlay (tints the entire page).  CSS: --fx-wash-color, --fx-wash-opacity */
  colorWash?: { enabled: boolean; color: string; opacity: number }
}

/**
 * Image & card hover effects — applied via CSS classes using data-fx-* attributes
 * on the <html> element.  Disabled means the class / data attribute is absent → zero cost.
 */
export interface HoverEffects {
  /** Scale images on hover.  CSS: .img-hover-zoom img:hover { scale: --fx-hover-zoom } */
  imageHoverZoom?: { enabled: boolean; scale: number }
  /** 3D tilt on image hover (CSS perspective + rotateX/Y).  data-fx-hover-tilt */
  imageHoverTilt?: { enabled: boolean }
  /** Glow behind images on hover.  CSS: --fx-hover-glow-color, --fx-hover-glow-blur */
  imageHoverGlow?: { enabled: boolean; color: string; blur: number }
  /** Scale up cards on hover.  CSS: --fx-card-hover-scale */
  cardHoverScale?: { enabled: boolean; scale: number }
  /** Drop-shadow lift on card hover.  CSS: --fx-card-hover-lift */
  cardHoverLift?: { enabled: boolean; intensity: number }
}

/**
 * Text decoration effects — applied to headings / body text.
 */
export interface TextEffects {
  /** Neon glow on headings.  CSS: --fx-heading-glow-color, --fx-heading-glow-blur */
  headingGlow?: { enabled: boolean; color: string; blur: number }
  /** Animated gradient shimmer across text.  data-fx-text-shimmer */
  textShimmer?: { enabled: boolean }
}

/**
 * Global UI effects.
 */
export interface UiEffects {
  /** Pulse animation on borders.  CSS: --fx-border-pulse-speed  data-fx-border-pulse */
  borderPulse?: { enabled: boolean; speed: number }
  /** Ripple on button click.  data-fx-btn-ripple */
  buttonRipple?: { enabled: boolean }
  /** Scroll-triggered fade-in for page sections.  data-fx-scroll-reveal */
  scrollReveal?: { enabled: boolean }
}

/**
 * Full effects configuration.  All sub-objects are optional so partial updates
 * can be stored without touching unrelated effects.
 */
export interface ThemeEffects {
  overlay?: OverlayEffects
  hover?: HoverEffects
  text?: TextEffects
  ui?: UiEffects
  /** Raw CSS injected after all generated rules — for advanced customisation. */
  customCss?: string
}

export interface ThemeGlass {
  /** backdrop-filter blur value, e.g. "12px".  CSS: --glass-blur */
  blur?: string
  /** Glass layer opacity (0–1 string), e.g. "0.2".  CSS: --glass-opacity */
  opacity?: string
}

export interface ThemeAnimation {
  /**
   * Named animation preset key matching ANIMATION_PRESETS in animationPresets.ts.
   * Examples: "fade", "slide-up", "glitch-fade", "neon-flicker", "scale-in".
   */
  preset?: string
  /**
   * Transition duration for enter/exit animations, e.g. "0.4s".
   * CSS token: --animation-duration
   */
  duration?: string
}

// ── Root type ─────────────────────────────────────────────────────────────────

export interface ThemeConfig {
  colors: ThemeColors
  gradients: ThemeGradients
  typography: ThemeTypography
  glass: ThemeGlass
  animation: ThemeAnimation
  /** Optional complete effects configuration. */
  effects?: ThemeEffects
  /**
   * Identifier of the full theme preset this config was derived from.
   * Used by the Themes tab to highlight the active preset.
   */
  themeId?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Default (empty-override) ThemeConfig — means "use globals.css defaults". */
export const EMPTY_THEME_CONFIG: ThemeConfig = {
  colors: {
    primary: '',
    secondary: '',
    background: '',
    foreground: '',
    card: '',
    muted: '',
    accent: '',
    border: '',
  },
  gradients: {},
  typography: {},
  glass: {},
  animation: {},
}

/**
 * Build a ThemeConfig from the legacy flat SiteSettings theme fields so that
 * old data continues to work seamlessly during and after migration.
 */
export function themeConfigFromFlatFields(fields: {
  themePrimary?: string
  themeSecondary?: string
  themeBackground?: string
  themeForeground?: string
  themeCard?: string
  themeMuted?: string
  themeAccent?: string
  themeBorder?: string
  themeGradientHeroFrom?: string
  themeGradientHeroTo?: string
  themeGradientHeroDir?: string
  themeGradientAccentFrom?: string
  themeGradientAccentTo?: string
  themeGradientAccentDir?: string
}): ThemeConfig {
  return {
    colors: {
      primary:    fields.themePrimary    ?? '',
      secondary:  fields.themeSecondary  ?? '',
      background: fields.themeBackground ?? '',
      foreground: fields.themeForeground ?? '',
      card:       fields.themeCard       ?? '',
      muted:      fields.themeMuted      ?? '',
      accent:     fields.themeAccent     ?? '',
      border:     fields.themeBorder     ?? '',
    },
    gradients: {
      heroFrom:   fields.themeGradientHeroFrom   ?? '',
      heroTo:     fields.themeGradientHeroTo     ?? '',
      heroDir:    fields.themeGradientHeroDir    ?? '135deg',
      accentFrom: fields.themeGradientAccentFrom ?? '',
      accentTo:   fields.themeGradientAccentTo   ?? '',
      accentDir:  fields.themeGradientAccentDir  ?? '135deg',
    },
    typography: {},
    glass: {},
    animation: {},
  }
}

/**
 * Safely parse a JSON string into a ThemeConfig.
 * Returns null if the string is empty/null or cannot be parsed.
 */
export function parseThemeConfig(json: string | null | undefined): ThemeConfig | null {
  if (!json || !json.trim()) return null
  try {
    const raw = JSON.parse(json) as Record<string, unknown>
    // Minimal runtime validation — ensure top-level keys exist
    if (raw && typeof raw === 'object' && 'colors' in raw) {
      return raw as unknown as ThemeConfig
    }
    return null
  } catch {
    return null
  }
}
