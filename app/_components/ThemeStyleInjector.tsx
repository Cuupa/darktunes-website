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
 *   colors.primary                 → --primary
 *   colors.secondary               → --secondary
 *   colors.background              → --background
 *   colors.foreground              → --foreground
 *   colors.card                    → --card
 *   colors.muted                   → --muted
 *   colors.accent                  → --accent
 *   colors.border                  → --border
 *   gradients.*                    → --gradient-hero, --gradient-accent (computed)
 *   typography.fontFamily          → --font-family-body
 *   typography.headingFamily       → --font-family-heading
 *   typography.serifFamily         → --font-serif  (wires all font-serif Tailwind usages)
 *   typography.headingSize         → --heading-size
 *   typography.headingScale        → --heading-scale (h2/h3 via CSS calc())
 *   typography.bodySize            → --body-size
 *   typography.bodyWeight          → --body-weight
 *   typography.headingWeight       → --heading-weight
 *   typography.lineHeight          → --line-height-body
 *   typography.lineHeightHeading   → --line-height-heading
 *   typography.letterSpacing       → --letter-spacing-body
 *   typography.letterSpacingHeading→ --letter-spacing-heading
 *   glass.blur                     → --glass-blur
 *   glass.opacity                  → --glass-opacity
 *   animation.duration             → --animation-duration
 */

import React from 'react'
import type { ThemeConfig } from '@/config/themeConfig'
import { sanitizeThemeCss } from '@/lib/sanitizeThemeCss'

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

// ── Google Font helpers ───────────────────────────────────────────────────────

/**
 * Maps a CSS font-family name to the Google Fonts CSS2 API URL fragment.
 * Add new entries as needed; names must match what ThemeConfig.typography stores.
 * Values are bare family specs — weights are added dynamically by `buildFontSpec`.
 */
export const GOOGLE_FONT_URL_MAP: Record<string, string> = {
  Inter:              'Inter:wght@300;400;500;600;700',
  Roboto:             'Roboto:wght@300;400;500;700',
  'Open Sans':        'Open+Sans:wght@300;400;600;700',
  Lato:               'Lato:wght@300;400;700',
  Montserrat:         'Montserrat:wght@300;400;600;700',
  Raleway:            'Raleway:wght@300;400;600;700',
  Poppins:            'Poppins:wght@300;400;500;600;700',
  'Playfair Display': 'Playfair+Display:wght@400;500;600;700',
  'DM Sans':          'DM+Sans:wght@300;400;500;700',
  Nunito:             'Nunito:wght@300;400;600;700',
  // Extended font library
  Oswald:             'Oswald:wght@300;400;500;600;700',
  'Source Sans 3':    'Source+Sans+3:wght@300;400;600;700',
  Ubuntu:             'Ubuntu:wght@300;400;500;700',
  Merriweather:       'Merriweather:wght@300;400;700',
  'PT Sans':          'PT+Sans:wght@400;700',
  Mulish:             'Mulish:wght@300;400;600;700',
  Quicksand:          'Quicksand:wght@300;400;500;600;700',
  'Josefin Sans':     'Josefin+Sans:wght@300;400;600;700',
  Exo:                'Exo:wght@300;400;600;700',
  'Exo 2':            'Exo+2:wght@300;400;600;700',
  Orbitron:           'Orbitron:wght@400;500;600;700;800;900',
  'Space Grotesk':    'Space+Grotesk:wght@300;400;500;600;700',
  'Space Mono':       'Space+Mono:wght@400;700',
  'Share Tech Mono':  'Share+Tech+Mono',
  'Share Tech':       'Share+Tech',
  'Bebas Neue':       'Bebas+Neue',
  'Alfa Slab One':    'Alfa+Slab+One',
  Anton:              'Anton',
  Barlow:             'Barlow:wght@300;400;600;700',
  'Barlow Condensed': 'Barlow+Condensed:wght@300;400;600;700',
  Comfortaa:          'Comfortaa:wght@300;400;600;700',
  Outfit:             'Outfit:wght@300;400;500;600;700',
  Manrope:            'Manrope:wght@300;400;500;600;700',
  Syne:               'Syne:wght@400;500;600;700;800',
  'Big Shoulders Display': 'Big+Shoulders+Display:wght@400;600;700;900',
  'Libre Baskerville': 'Libre+Baskerville:wght@400;700',
  Cinzel:             'Cinzel:wght@400;600;700;900',
  'Cormorant Garamond': 'Cormorant+Garamond:wght@300;400;600',
  'DM Serif Display': 'DM+Serif+Display',
  Spectral:           'Spectral:wght@300;400;600;700',
  'Fira Code':        'Fira+Code:wght@300;400;500;600;700',
  'JetBrains Mono':   'JetBrains+Mono:wght@300;400;600;700',
  'Source Code Pro':  'Source+Code+Pro:wght@300;400;600;700',
  Inconsolata:        'Inconsolata:wght@300;400;600;700',
  'IBM Plex Mono':    'IBM+Plex+Mono:wght@300;400;600;700',
  'IBM Plex Sans':    'IBM+Plex+Sans:wght@300;400;500;600;700',
}

/**
 * Build a minimal Google Fonts weight spec for the given font name.
 * When specific weights are provided, requests only those (plus 400 as safety
 * fallback) — reducing the number of font-file round-trips.
 *
 * For unknown font names, auto-constructs a URL from the name alone so that
 * admins can type any valid Google Font name without needing a map entry.
 *
 * @param fontName   Font family name as stored in ThemeConfig (e.g. "DM Sans")
 * @param weights    Desired numeric weights (e.g. ["400","700"])
 * @returns          Google Fonts CSS2 API family spec fragment, or null
 */
export function buildGoogleFontSpec(fontName: string, weights: string[] = []): string | null {
  if (!fontName || !fontName.trim()) return null

  // Strip CSS fallback stacks — only take the first font name
  const cleanName = fontName.split(',')[0].trim().replace(/^['"]|['"]$/g, '')
  if (!cleanName) return null
  // Full URL passthrough — not a Google Font name
  if (cleanName.startsWith('http')) return null

  // Resolve URL-encoded family name
  const mapEntry = GOOGLE_FONT_URL_MAP[cleanName]
  const urlFamilyName = mapEntry
    ? mapEntry.split(':')[0]                   // e.g. "DM+Sans"
    : cleanName.replace(/ /g, '+')             // auto-encode unknown names

  // Build minimal weight spec when weights are known
  const uniqueWeights = [...new Set(['400', ...weights.filter(Boolean)])].sort((a, b) => +a - +b)
  const weightSpec = `wght@${uniqueWeights.join(';')}`

  return `${urlFamilyName}:${weightSpec}`
}

/**
 * Returns true when `fontName` is a recognisable Google Font (either in
 * GOOGLE_FONT_URL_MAP or a non-empty, non-URL string that can be tried on GF).
 */
export function isGoogleFont(fontName: string): boolean {
  if (!fontName || !fontName.trim()) return false
  if (fontName.startsWith('http')) return false         // full URL — not a GF name
  const clean = fontName.split(',')[0].trim().replace(/^['"]|['"]$/g, '')
  return !!clean
}

type LegacyColorKey = keyof Omit<ThemeColors, 'themeConfig'>

const LEGACY_TOKEN_MAP: Array<[LegacyColorKey, string]> = [
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

/** Safely escape CSS string values to prevent injection. */
function safeColor(v: string | undefined): string | undefined {
  if (!v) return undefined
  // Allow hex, rgb(), hsl(), oklch(), named colors, and 'transparent'
  const clean = v.trim()
  if (/^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s,.%]+\)|hsl[a]?\([\d\s,.%]+\)|oklch\([^)]+\)|[a-zA-Z]+|transparent)$/.test(clean)) {
    return clean
  }
  return undefined
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
  const typo = themeConfig?.typography
  if (typo) {
    if (notEmpty(typo.fontFamily))    declarations.push(`  --font-family-body: '${typo.fontFamily}', sans-serif;`)
    if (notEmpty(typo.headingFamily)) declarations.push(`  --font-family-heading: '${typo.headingFamily}', sans-serif;`)

    // --font-serif wiring: dedicated serifFamily takes highest precedence;
    // otherwise, when a body font is configured, inherit it so all font-serif
    // Tailwind usages (Hero, bios, MarkdownContent, subtitles) follow the
    // admin-chosen typeface instead of the hard-wired Georgia fallback.
    if (notEmpty(typo.serifFamily)) {
      declarations.push(`  --font-serif: '${typo.serifFamily}', serif;`)
    } else if (notEmpty(typo.fontFamily)) {
      declarations.push(`  --font-serif: var(--font-family-body);`)
    }

    if (notEmpty(typo.headingSize))            declarations.push(`  --heading-size: ${typo.headingSize};`)
    if (notEmpty(typo.headingScale))           declarations.push(`  --heading-scale: ${typo.headingScale};`)
    if (notEmpty(typo.bodySize))               declarations.push(`  --body-size: ${typo.bodySize};`)
    if (notEmpty(typo.bodyWeight))             declarations.push(`  --body-weight: ${typo.bodyWeight};`)
    if (notEmpty(typo.headingWeight))          declarations.push(`  --heading-weight: ${typo.headingWeight};`)
    if (notEmpty(typo.lineHeight))             declarations.push(`  --line-height-body: ${typo.lineHeight};`)
    if (notEmpty(typo.lineHeightHeading))      declarations.push(`  --line-height-heading: ${typo.lineHeightHeading};`)
    if (notEmpty(typo.letterSpacing))          declarations.push(`  --letter-spacing-body: ${typo.letterSpacing};`)
    if (notEmpty(typo.letterSpacingHeading))   declarations.push(`  --letter-spacing-heading: ${typo.letterSpacingHeading};`)
  }

  // ── Glass (themeConfig only) ─────────────────────────────────────────────
  const glassBlur    = themeConfig?.glass.blur
  const glassOpacity = themeConfig?.glass.opacity
  if (notEmpty(glassBlur))    declarations.push(`  --glass-blur: ${glassBlur};`)
  if (notEmpty(glassOpacity)) declarations.push(`  --glass-opacity: ${glassOpacity};`)

  // ── Animation (themeConfig only) ─────────────────────────────────────────
  const animDuration = themeConfig?.animation.duration
  if (notEmpty(animDuration)) declarations.push(`  --animation-duration: ${animDuration};`)

  // ── Effects CSS vars ─────────────────────────────────────────────────────
  const fx = themeConfig?.effects
  if (fx) {
    // Overlay
    if (fx.overlay?.chromaticAberration?.enabled) {
      declarations.push(`  --fx-chromatic-offset: ${fx.overlay.chromaticAberration.intensity}px;`)
    }
    if (fx.overlay?.colorWash?.enabled) {
      const washColor = safeColor(fx.overlay.colorWash.color) ?? 'transparent'
      declarations.push(`  --fx-wash-color: ${washColor};`)
      declarations.push(`  --fx-wash-opacity: ${fx.overlay.colorWash.opacity};`)
    }
    // Hover
    if (fx.hover?.imageHoverZoom?.enabled) {
      declarations.push(`  --fx-hover-zoom: ${fx.hover.imageHoverZoom.scale};`)
    }
    if (fx.hover?.imageHoverGlow?.enabled) {
      const glowColor = safeColor(fx.hover.imageHoverGlow.color) ?? 'transparent'
      declarations.push(`  --fx-hover-glow-color: ${glowColor};`)
      declarations.push(`  --fx-hover-glow-blur: ${fx.hover.imageHoverGlow.blur}px;`)
    }
    if (fx.hover?.cardHoverScale?.enabled) {
      declarations.push(`  --fx-card-hover-scale: ${fx.hover.cardHoverScale.scale};`)
    }
    if (fx.hover?.cardHoverLift?.enabled) {
      declarations.push(`  --fx-card-hover-lift: ${fx.hover.cardHoverLift.intensity}px;`)
    }
    // Text
    if (fx.text?.headingGlow?.enabled) {
      const hgColor = safeColor(fx.text.headingGlow.color) ?? 'transparent'
      declarations.push(`  --fx-heading-glow-color: ${hgColor};`)
      declarations.push(`  --fx-heading-glow-blur: ${fx.text.headingGlow.blur}px;`)
    }
    // UI
    if (fx.ui?.borderPulse?.enabled) {
      declarations.push(`  --fx-border-pulse-speed: ${fx.ui.borderPulse.speed}s;`)
    }
  }

  const fontFamily     = typo?.fontFamily
  const headingFamily  = typo?.headingFamily
  const serifFamily    = typo?.serifFamily
  const bodyWeight     = typo?.bodyWeight
  const headingWeight  = typo?.headingWeight
  const hasDeclarations = declarations.length > 0

  // ── Google Font links (SSR-safe — rendered into <head> by RootLayout) ────
  // Collects (fontName → weights[]) pairs; deduplicates when body == heading.
  const fontWeightMap = new Map<string, Set<string>>()

  function addFontLoad(name: string | undefined, weights: string[]) {
    if (!name || !name.trim()) return
    const clean = name.split(',')[0].trim().replace(/^['"]|['"]$/g, '')
    if (!clean || clean.startsWith('http')) return
    if (!fontWeightMap.has(clean)) fontWeightMap.set(clean, new Set(['400']))
    const set = fontWeightMap.get(clean)!
    weights.forEach((w) => w && set.add(w))
  }

  // Only request the weights actually used in the design (subsetting)
  addFontLoad(fontFamily,    [bodyWeight ?? '400'])
  addFontLoad(headingFamily, [headingWeight ?? '700'])
  addFontLoad(serifFamily,   [bodyWeight ?? '400', headingWeight ?? '700'])

  const fontLinks: React.ReactNode[] = []

  if (fontWeightMap.size > 0) {
    const specs = Array.from(fontWeightMap.entries())
      .map(([name, wSet]) => buildGoogleFontSpec(name, Array.from(wSet)))
      .filter((s): s is string => s !== null)

    if (specs.length > 0) {
      const families = specs.join('&family=')
      const fontsUrl = `https://fonts.googleapis.com/css2?family=${families}&display=swap`

      fontLinks.push(
        <link key="gf-preconnect"        rel="preconnect" href="https://fonts.googleapis.com" />,
        <link key="gf-preconnect-origin" rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />,
        <link key="gf-preload"           rel="preload" as="style" href={fontsUrl} />,
        <link key="gf-stylesheet"        rel="stylesheet" href={fontsUrl} />,
      )
    }
  }

  // ── Custom CSS (sanitized — never inject raw admin CSS into <style>) ─────
  const customCss = sanitizeThemeCss(themeConfig?.effects?.customCss)

  if (!hasDeclarations && fontLinks.length === 0 && !customCss) return null

  const rootBlock = hasDeclarations ? `:root {\n${declarations.join('\n')}\n}` : ''

  return (
    <>
      {fontLinks}
      {(rootBlock || customCss) && (
        <style dangerouslySetInnerHTML={{ __html: [rootBlock, customCss].filter(Boolean).join('\n') }} />
      )}
    </>
  )
}
