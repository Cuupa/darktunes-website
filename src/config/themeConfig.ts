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
 *   typography.fontFamily → --font-family-body
 *   typography.headingSize → --heading-size
 *   glass.blur           → --glass-blur
 *   glass.opacity        → --glass-opacity
 *   animation.duration   → --animation-duration
 *   animation.preset     → consumed by PageTransition / animationPresets
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
   * CSS font-family string, e.g. "'Inter', sans-serif".
   * When set to a Google Font name, ThemeStyleInjector injects a <link> tag.
   * CSS token: --font-family-body
   */
  fontFamily?: string
  /**
   * Base heading size, e.g. "3rem".
   * CSS token: --heading-size
   */
  headingSize?: string
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
      return raw as ThemeConfig
    }
    return null
  } catch {
    return null
  }
}
