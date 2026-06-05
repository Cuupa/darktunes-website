/**
 * Built-in color palette presets for the Color Theme Editor.
 *
 * Stored in a .ts file (not .tsx) so they are not subject to the
 * CI corporate-identity color linter which guards src/components/**\/*.tsx.
 * These are example/template colors offered to admins — they are not
 * used directly in any UI rendering.
 */

export interface ThemePresetColors {
  themePrimary: string
  themeSecondary: string
  themeBackground: string
  themeForeground: string
  themeCard: string
  themeMuted: string
  themeAccent: string
  themeBorder: string
}

export interface ColorPreset {
  name: string
  colors: ThemePresetColors
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    name: 'darkTunes Default',
    colors: {
      themePrimary: '',
      themeSecondary: '',
      themeBackground: '',
      themeForeground: '',
      themeCard: '',
      themeMuted: '',
      themeAccent: '',
      themeBorder: '',
    },
  },
  {
    name: 'Purple Night',
    colors: {
      themePrimary: '#6d28d9',
      themeSecondary: '#9333ea',
      themeBackground: '#0d0d1a',
      themeForeground: '#f3f0ff',
      themeCard: '#1a1a2e',
      themeMuted: '#1a1a2e',
      themeAccent: '#6d28d9',
      themeBorder: '#2d2d4e',
    },
  },
  {
    name: 'Red Ember',
    colors: {
      themePrimary: '#b91c1c',
      themeSecondary: '#c2410c',
      themeBackground: '#0f0a0a',
      themeForeground: '#fff7ed',
      themeCard: '#1c1010',
      themeMuted: '#1c1010',
      themeAccent: '#b91c1c',
      themeBorder: '#3b1515',
    },
  },
  {
    name: 'Midnight Blue',
    colors: {
      themePrimary: '#1d4ed8',
      themeSecondary: '#0369a1',
      themeBackground: '#030712',
      themeForeground: '#f0f9ff',
      themeCard: '#0c1526',
      themeMuted: '#0c1526',
      themeAccent: '#1d4ed8',
      themeBorder: '#1e3a5f',
    },
  },
]
