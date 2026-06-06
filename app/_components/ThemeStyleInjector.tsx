/**
 * ThemeStyleInjector — Server Component
 *
 * Injects an inline `<style>` tag into `<head>` that overrides CSS custom
 * properties with admin-configured color tokens.  Because this renders server-
 * side, the override is present in the initial HTML and there is no flash of
 * unstyled content (FOUC).
 *
 * Only properties with non-empty values are emitted.  Empty values mean "use
 * the default from globals.css", so no override is needed.
 *
 * CSS token map:
 *   themePrimary          → --primary
 *   themeSecondary        → --secondary
 *   themeBackground       → --background
 *   themeForeground       → --foreground
 *   themeCard             → --card
 *   themeMuted            → --muted
 *   themeAccent           → --accent
 *   themeBorder           → --border
 *   themeGradient*        → --gradient-hero, --gradient-accent (computed)
 */

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
}

const TOKEN_MAP: Array<[keyof ThemeColors, string]> = [
  ['themePrimary',    '--primary'],
  ['themeSecondary',  '--secondary'],
  ['themeBackground', '--background'],
  ['themeForeground', '--foreground'],
  ['themeCard',       '--card'],
  ['themeMuted',      '--muted'],
  ['themeAccent',     '--accent'],
  ['themeBorder',     '--border'],
]

export function ThemeStyleInjector(colors: ThemeColors) {
  const declarations: string[] = TOKEN_MAP
    .filter(([key]) => {
      const v = colors[key]
      return typeof v === 'string' && v.trim() !== ''
    })
    .map(([key, cssVar]) => `  ${cssVar}: ${colors[key]};`)

  // Computed gradient tokens — only inject when from+to are set
  const heroFrom = colors.themeGradientHeroFrom?.trim()
  const heroTo = colors.themeGradientHeroTo?.trim()
  const heroDir = colors.themeGradientHeroDir?.trim() || '135deg'
  if (heroFrom && heroTo) {
    declarations.push(`  --gradient-hero: linear-gradient(${heroDir}, ${heroFrom}, ${heroTo});`)
  }
  const accentFrom = colors.themeGradientAccentFrom?.trim()
  const accentTo = colors.themeGradientAccentTo?.trim()
  const accentDir = colors.themeGradientAccentDir?.trim() || '135deg'
  if (accentFrom && accentTo) {
    declarations.push(`  --gradient-accent: linear-gradient(${accentDir}, ${accentFrom}, ${accentTo});`)
  }

  if (declarations.length === 0) return null

  const css = `:root {\n${declarations.join('\n')}\n}`

  return (
    <style dangerouslySetInnerHTML={{ __html: css }} />
  )
}
