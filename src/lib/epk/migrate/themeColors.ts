/**
 * src/lib/epk/migrate/themeColors.ts
 *
 * Resolves EPK theme colors for canvas document migration.
 */

import { buildCustomTheme, getEPKTheme } from '@/lib/epk/themes'
import type { ArtistProfile } from '@/lib/api/artistProfiles'

export interface EpkThemeColors {
  background: string
  text: string
  accent: string
  heading: string
  muted: string
  headerBg: string
}

function cssColorToHex(color: string, fallback: string): string {
  if (color.startsWith('#')) return color
  // HSL CSS variables — use darkTunes brand fallbacks
  if (color.includes('var(--card)') || color.includes('hsl(var(--card))')) return '#292929'
  if (color.includes('var(--foreground)')) return '#ffffff'
  if (color.includes('var(--primary)')) return '#493687'
  if (color.includes('var(--muted-foreground)')) return '#a0a0a0'
  if (color.includes('var(--secondary)')) return '#7e1e37'
  if (color.startsWith('#')) return color
  return fallback
}

export function resolveEpkThemeColors(profile: ArtistProfile): EpkThemeColors {
  const hasCustom = Object.keys(profile.epkCustomThemeTokens).length > 0
  const theme = hasCustom
    ? buildCustomTheme(profile.epkCustomThemeTokens)
    : getEPKTheme(profile.epkTheme)

  const text = hasCustom
    ? profile.epkCustomThemeTokens.text ?? '#ffffff'
    : cssColorToHex(String(theme.text.color ?? '#ffffff'), '#ffffff')

  const background = hasCustom
    ? profile.epkCustomThemeTokens.bg ?? '#292929'
    : cssColorToHex(String(theme.article.background ?? '#292929'), '#292929')

  const accent = hasCustom
    ? profile.epkCustomThemeTokens.accent ?? '#493687'
    : cssColorToHex(theme.accent, '#493687')

  const heading = hasCustom
    ? profile.epkCustomThemeTokens.heading ?? '#a0a0a0'
    : cssColorToHex(String(theme.sectionHeading.color ?? '#a0a0a0'), '#a0a0a0')

  const headerBg = cssColorToHex(String(theme.header.background ?? background), background)

  return {
    background,
    text,
    accent,
    heading,
    muted: '#a0a0a0',
    headerBg,
  }
}