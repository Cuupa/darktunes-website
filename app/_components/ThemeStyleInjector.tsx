/**
 * ThemeStyleInjector — Server Component
 *
 * Injects an inline `<style>` tag (and optionally `<link>` tags for Google
 * Fonts) into `<head>` that overrides CSS custom properties with admin-
 * configured design tokens.  Because this renders server-side the override is
 * present in the initial HTML — no flash of unstyled content (FOUC).
 *
 * Accepts either a `themeConfig` (full structured ThemeConfig) or the legacy
 * flat `theme*` props.  When both are present, `themeConfig` takes precedence
 * for the new typography / glass / animation tokens; flat props are used as
 * fallback for color and gradient tokens.
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
 *   gradients.*          → --gradient-hero, --gradient-accent (computed)
 *   typography.fontFamily → --font-family-body
 *   typography.headingSize → --heading-size
 *   glass.blur           → --glass-blur
 *   glass.opacity        → --glass-opacity
 *   animation.duration   → --animation-duration
 */

import type { ThemeConfig } from '@/config/themeConfig'

// ── Flat-field legacy interface (kept for backward compatibility) ─────────────

export interface ThemeColors {
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
  /** Structured theme config — takes precedence over flat fields for new tokens. */
  themeConfig?: ThemeConfig
}

// ── Google Font lookup ────────────────────────────────────────────────────────

/**
 * Maps a CSS font-family name to the Google Fonts CSS2 API URL fragment.
 * Add new entries as needed; names must match what ThemeConfig.typography.fontFamily stores.
 */
const GOOGLE_FONT_URL_MAP: Record<string, string> = {
  Inter:           'Inter:wght@300;400;500;600;700',
  Roboto:          'Roboto:wght@300;400;500;700',
  'Open Sans':     'Open+Sans:wght@300;400;600;700',
  Lato:            'Lato:wght@300;400;700',
  Montserrat:      'Montserrat:wght@300;400;600;700',
  Raleway:         'Raleway:wght@300;400;600;700',
  Poppins:         'Poppins:wght@300;400;500;600;700',
  'Playfair Display': 'Playfair+Display:wght@400;500;600;700',
  'DM Sans':       'DM+Sans:wght@300;400;500;700',
  Nunito:          'Nunito:wght@300;400;600;700',
}

const LEGACY_TOKEN_MAP: Array<[keyof ThemeColors, string]> = [
  ['themePrimary',    '--primary'],
  ['themeSecondary',  '--secondary'],
  ['themeBackground', '--background'],
  ['themeForeground', '--foreground'],
  ['themeCard',       '--card'],
  ['themeMuted',      '--muted'],
  ['themeAccent',     '--accent'],
  ['themeBorder',     '--border'],
]

function notEmpty(v: string | undefined): v is string {
  return typeof v === 'string' && v.trim() !== ''
}

export function ThemeStyleInjector(props: ThemeColors) {
  const { themeConfig, ...flat } = props
  const declarations: string[] = []

  // ── Colors (themeConfig.colors first, flat fallback) ────────────────────
  const colorSources: Record<string, string | undefined> = themeConfig?.colors
    ? {
        '--primary':    themeConfig.colors.primary,
        '--secondary':  themeConfig.colors.secondary,
        '--background': themeConfig.colors.background,
        '--foreground': themeConfig.colors.foreground,
        '--card':       themeConfig.colors.card,
        '--muted':      themeConfig.colors.muted,
        '--accent':     themeConfig.colors.accent,
        '--border':     themeConfig.colors.border,
      }
    : Object.fromEntries(
        LEGACY_TOKEN_MAP
          .filter(([key]) => notEmpty(flat[key]))
          .map(([key, cssVar]) => [cssVar, flat[key]]),
      )

  for (const [cssVar, val] of Object.entries(colorSources)) {
    if (notEmpty(val)) declarations.push(`  ${cssVar}: ${val};`)
  }

  // ── Gradients (themeConfig.gradients first, flat fallback) ───────────────
  const heroFrom   = themeConfig?.gradients.heroFrom   ?? flat.themeGradientHeroFrom
  const heroTo     = themeConfig?.gradients.heroTo     ?? flat.themeGradientHeroTo
  const heroDir    = (themeConfig?.gradients.heroDir   ?? flat.themeGradientHeroDir ?? '135deg').trim() || '135deg'
  if (notEmpty(heroFrom) && notEmpty(heroTo)) {
    declarations.push(`  --gradient-hero: linear-gradient(${heroDir}, ${heroFrom}, ${heroTo});`)
  }

  const accentFrom = themeConfig?.gradients.accentFrom ?? flat.themeGradientAccentFrom
  const accentTo   = themeConfig?.gradients.accentTo   ?? flat.themeGradientAccentTo
  const accentDir  = (themeConfig?.gradients.accentDir ?? flat.themeGradientAccentDir ?? '135deg').trim() || '135deg'
  if (notEmpty(accentFrom) && notEmpty(accentTo)) {
    declarations.push(`  --gradient-accent: linear-gradient(${accentDir}, ${accentFrom}, ${accentTo});`)
  }

  // ── Typography (themeConfig only) ───────────────────────────────────────
  const fontFamily  = themeConfig?.typography.fontFamily
  const headingSize = themeConfig?.typography.headingSize
  if (notEmpty(fontFamily))  declarations.push(`  --font-family-body: ${fontFamily};`)
  if (notEmpty(headingSize)) declarations.push(`  --heading-size: ${headingSize};`)

  // ── Glass (themeConfig only) ─────────────────────────────────────────────
  const glassBlur    = themeConfig?.glass.blur
  const glassOpacity = themeConfig?.glass.opacity
  if (notEmpty(glassBlur))    declarations.push(`  --glass-blur: ${glassBlur};`)
  if (notEmpty(glassOpacity)) declarations.push(`  --glass-opacity: ${glassOpacity};`)

  // ── Animation (themeConfig only) ─────────────────────────────────────────
  const animDuration = themeConfig?.animation.duration
  if (notEmpty(animDuration)) declarations.push(`  --animation-duration: ${animDuration};`)

  if (declarations.length === 0 && !notEmpty(fontFamily)) return null

  const css = `:root {\n${declarations.join('\n')}\n}`

  // ── Google Font links (SSR-safe — rendered into <head> by RootLayout) ────
  const fontLinks: React.ReactNode[] = []
  if (notEmpty(fontFamily) && GOOGLE_FONT_URL_MAP[fontFamily]) {
    const familyParam = GOOGLE_FONT_URL_MAP[fontFamily]
    fontLinks.push(
      <link key="gf-preconnect" rel="preconnect" href="https://fonts.googleapis.com" />,
      <link key="gf-preconnect-origin" rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />,
      <link
        key="gf-stylesheet"
        rel="stylesheet"
        href={`https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`}
      />,
    )
  }

  if (declarations.length === 0) {
    return fontLinks.length > 0 ? <>{fontLinks}</> : null
  }

  return (
    <>
      {fontLinks}
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </>
  )
}

