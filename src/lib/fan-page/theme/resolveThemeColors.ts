import type { FanPageTheme } from '@/lib/fan-page/schema/documentV1'
import { getPaletteById } from '@/lib/fan-page/templates/palettes'

export interface FanPageThemeColors {
  primary: string
  accent: string
  background: string
  text: string
}

export function resolveThemeColors(theme: FanPageTheme): FanPageThemeColors {
  const palette = getPaletteById(theme.paletteId)
  return {
    primary: theme.customColors?.primary ?? palette.primary,
    accent: theme.customColors?.accent ?? palette.accent,
    background: theme.customColors?.background ?? palette.background,
    text: palette.text,
  }
}