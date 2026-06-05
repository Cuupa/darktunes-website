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
 *   themePrimary    → --primary
 *   themeSecondary  → --secondary
 *   themeBackground → --background
 *   themeForeground → --foreground
 *   themeCard       → --card
 *   themeMuted      → --muted
 *   themeAccent     → --accent
 *   themeBorder     → --border
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
  const declarations = TOKEN_MAP
    .filter(([key]) => {
      const v = colors[key]
      return typeof v === 'string' && v.trim() !== ''
    })
    .map(([key, cssVar]) => `  ${cssVar}: ${colors[key]};`)
    .join('\n')

  if (!declarations) return null

  const css = `:root {\n${declarations}\n}`

  return (
    <style dangerouslySetInnerHTML={{ __html: css }} />
  )
}
