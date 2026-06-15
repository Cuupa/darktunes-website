'use client'

/**
 * src/components/admin/ColorThemeManager.tsx
 *
 * Admin panel for customising the site's design-token color palette.
 *
 * Tabs:
 *  - Themes    : 6 signature + 20 general presets — one-click full-theme apply
 *  - Colors    : 8 CSS token rows + saveable custom presets + WCAG contrast check
 *  - Effects   : 15+ toggleable visual effects (overlay, hover, text, UI, custom CSS)
 *  - Gradients : Hero & Accent gradients (from/to/direction + live preview)
 *  - Typography: 50+ fonts, heading/body split, weights, sizes, line-height, letter-spacing
 *  - Animations: Page-transition preset + duration
 *  - Contrast  : WCAG 2.1 AA/AAA contrast check
 *
 * State management: a single `useReducer` drives all editable theme fields
 * (`ThemeDraft`).  This eliminates the previous 15+ useState/useRef pairs and
 * keeps handleSave / handleCancel trivially simple.
 *
 * Live preview: CSS overrides are built into a `:root { … }` string and rendered
 * as an inline `<style data-id="ctm-live-preview">` element — no imperative
 * `document.documentElement.style.setProperty` calls.  React removes the element
 * on unmount, so color overrides never bleed into other pages.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowCounterClockwise,
  FloppyDisk,
  X,
  Warning,
  CheckCircle,
  Sparkle,
  BookmarkSimple,
  Trash,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { SiteSettings } from '@/types'
import { COLOR_PRESETS } from '@/config/colorPresets'
import type { ThemePresetColors } from '@/config/colorPresets'
import { ANIMATION_PRESETS, ANIMATION_PRESET_LABELS } from '@/config/animationPresets'
import type { ThemeConfig, ThemeEffects, ThemeTypography } from '@/config/themeConfig'
import { EffectsTab } from '@/components/admin/theme-tabs/EffectsTab'
import { TypographyTab } from '@/components/admin/theme-tabs/TypographyTab'
import { ThemesTab } from '@/components/admin/theme-tabs/ThemesTab'
import { GOOGLE_FONT_URL_MAP } from '../../../app/_components/ThemeStyleInjector'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ColorThemeManagerProps {
  value: SiteSettings
  onChange: (updated: SiteSettings) => Promise<void>
  isLoading?: boolean
}

/** Alias for the flat legacy color keys (themePrimary, themeSecondary, …) */
type LegacyColors = ThemePresetColors

interface TokenRow {
  key: keyof LegacyColors
  cssVar: string
  label: string
  defaultHint: string
}

interface CustomColorPreset {
  name: string
  colors: LegacyColors
}

// ── Atomic draft state ───────────────────────────────────────────────────────

/**
 * All mutable theme fields live in one atomic `ThemeDraft` object, managed by
 * `useReducer`.  This replaces the previous 15+ separate `useState` calls.
 */
interface ThemeDraft {
  colors: LegacyColors
  noiseOpacity: number
  crtEnabled: boolean
  vignetteIntensity: number
  effects: ThemeEffects
  heroFrom: string
  heroTo: string
  heroDir: string
  accentFrom: string
  accentTo: string
  accentDir: string
  typography: ThemeTypography
  animPreset: string
  animDuration: number
  activeThemeId: string | undefined
}

type ThemeAction =
  | { type: 'SET_COLOR';         key: keyof LegacyColors; value: string }
  | { type: 'RESET_COLOR';       key: keyof LegacyColors }
  | { type: 'APPLY_COLORS';      colors: LegacyColors }
  | { type: 'APPLY_THEME';       theme: ThemeConfig }
  | { type: 'SET_NOISE_OPACITY'; value: number }
  | { type: 'SET_CRT';           value: boolean }
  | { type: 'SET_VIGNETTE';      value: number }
  | { type: 'SET_EFFECTS';       effects: ThemeEffects }
  | { type: 'SET_HERO_FROM';     value: string }
  | { type: 'SET_HERO_TO';       value: string }
  | { type: 'SET_HERO_DIR';      value: string }
  | { type: 'SET_ACCENT_FROM';   value: string }
  | { type: 'SET_ACCENT_TO';     value: string }
  | { type: 'SET_ACCENT_DIR';    value: string }
  | { type: 'SET_TYPOGRAPHY';    typography: ThemeTypography }
  | { type: 'SET_ANIM_PRESET';   preset: string }
  | { type: 'SET_ANIM_DURATION'; duration: number }
  | { type: 'SET_DRAFT';         draft: ThemeDraft }

function themeReducer(state: ThemeDraft, action: ThemeAction): ThemeDraft {
  switch (action.type) {
    case 'SET_COLOR':
      return { ...state, colors: { ...state.colors, [action.key]: action.value } }
    case 'RESET_COLOR':
      return { ...state, colors: { ...state.colors, [action.key]: '' } }
    case 'APPLY_COLORS':
      return { ...state, colors: action.colors }
    case 'APPLY_THEME': {
      const t = action.theme
      return {
        ...state,
        colors: {
          themePrimary:    t.colors.primary,
          themeSecondary:  t.colors.secondary,
          themeBackground: t.colors.background,
          themeForeground: t.colors.foreground,
          themeCard:       t.colors.card,
          themeMuted:      t.colors.muted,
          themeAccent:     t.colors.accent,
          themeBorder:     t.colors.border,
        },
        heroFrom:         t.gradients.heroFrom   ?? '',
        heroTo:           t.gradients.heroTo     ?? '',
        heroDir:          t.gradients.heroDir    ?? '135deg',
        accentFrom:       t.gradients.accentFrom ?? '',
        accentTo:         t.gradients.accentTo   ?? '',
        accentDir:        t.gradients.accentDir  ?? '135deg',
        typography:       t.typography,
        animPreset:       t.animation.preset   ?? 'slide-up',
        animDuration:     parseFloat(t.animation.duration ?? '0.4') || 0.4,
        effects:          t.effects ?? state.effects,
        noiseOpacity:     t.effects?.overlay?.noiseOpacity     ?? state.noiseOpacity,
        crtEnabled:       t.effects?.overlay?.crtEnabled       ?? state.crtEnabled,
        vignetteIntensity: t.effects?.overlay?.vignetteIntensity ?? state.vignetteIntensity,
        activeThemeId:    t.themeId,
      }
    }
    case 'SET_NOISE_OPACITY':  return { ...state, noiseOpacity: action.value }
    case 'SET_CRT':            return { ...state, crtEnabled: action.value }
    case 'SET_VIGNETTE':       return { ...state, vignetteIntensity: action.value }
    case 'SET_EFFECTS':        return { ...state, effects: action.effects }
    case 'SET_HERO_FROM':      return { ...state, heroFrom: action.value }
    case 'SET_HERO_TO':        return { ...state, heroTo: action.value }
    case 'SET_HERO_DIR':       return { ...state, heroDir: action.value }
    case 'SET_ACCENT_FROM':    return { ...state, accentFrom: action.value }
    case 'SET_ACCENT_TO':      return { ...state, accentTo: action.value }
    case 'SET_ACCENT_DIR':     return { ...state, accentDir: action.value }
    case 'SET_TYPOGRAPHY':     return { ...state, typography: action.typography }
    case 'SET_ANIM_PRESET':    return { ...state, animPreset: action.preset }
    case 'SET_ANIM_DURATION':  return { ...state, animDuration: action.duration }
    case 'SET_DRAFT':          return action.draft
    default:                   return state
  }
}

// ── Token definitions ────────────────────────────────────────────────────────

const TOKEN_ROWS: TokenRow[] = [
  { key: 'themePrimary',    cssVar: '--primary',    label: 'Primary',    defaultHint: '#493687' },
  { key: 'themeSecondary',  cssVar: '--secondary',  label: 'Secondary',  defaultHint: '#7e1e37' },
  { key: 'themeBackground', cssVar: '--background', label: 'Background', defaultHint: '#101010' },
  { key: 'themeForeground', cssVar: '--foreground', label: 'Foreground', defaultHint: '#ffffff' },
  { key: 'themeCard',       cssVar: '--card',       label: 'Card',       defaultHint: '#101010' },
  { key: 'themeMuted',      cssVar: '--muted',      label: 'Muted',      defaultHint: '#292929' },
  { key: 'themeAccent',     cssVar: '--accent',     label: 'Accent',     defaultHint: '#493687' },
  { key: 'themeBorder',     cssVar: '--border',     label: 'Border',     defaultHint: '#101010' },
]

/** Contrast pair definitions: [label, fgKey/hint, bgKey/hint] */
const CONTRAST_PAIRS: Array<{ label: string; fg: string; bg: string; fgHint: string; bgHint: string }> = [
  { label: 'Text on Background',    fg: 'themeForeground', bg: 'themeBackground', fgHint: '#ffffff', bgHint: '#101010' },
  { label: 'Text on Card',          fg: 'themeForeground', bg: 'themeCard',       fgHint: '#ffffff', bgHint: '#101010' },
  { label: 'Primary on Background', fg: 'themePrimary',    bg: 'themeBackground', fgHint: '#493687', bgHint: '#101010' },
  { label: 'Secondary on Background',fg: 'themeSecondary', bg: 'themeBackground', fgHint: '#7e1e37', bgHint: '#101010' },
  { label: 'Accent on Background',  fg: 'themeAccent',     bg: 'themeBackground', fgHint: '#493687', bgHint: '#101010' },
  { label: 'Primary on Card',       fg: 'themePrimary',    bg: 'themeCard',       fgHint: '#493687', bgHint: '#101010' },
  { label: 'Muted on Background',   fg: 'themeMuted',      bg: 'themeBackground', fgHint: '#292929', bgHint: '#101010' },
]

const GRADIENT_DIRECTIONS = [
  { value: 'to right',       label: '→ To Right' },
  { value: 'to left',        label: '← To Left' },
  { value: 'to bottom',      label: '↓ To Bottom' },
  { value: 'to top',         label: '↑ To Top' },
  { value: '135deg',         label: '↘ 135°' },
  { value: '45deg',          label: '↗ 45°' },
  { value: '180deg',         label: '↓ 180°' },
  { value: '90deg',          label: '→ 90°' },
]

const CUSTOM_PRESETS_KEY = 'darktunes-admin-custom-color-presets'

// ── WCAG contrast helpers ────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '')
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ]
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ]
  }
  return null
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function contrastRatio(hex1: string, hex2: string): number | null {
  const rgb1 = hexToRgb(hex1)
  const rgb2 = hexToRgb(hex2)
  if (!rgb1 || !rgb2) return null
  const l1 = relativeLuminance(...rgb1)
  const l2 = relativeLuminance(...rgb2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a `SiteSettings` snapshot into the flat `ThemeDraft` the component
 * manages internally.  Used both as the `useReducer` initialiser and to update
 * the "original" ref when the parent pushes fresh data.
 */
function draftFromSettings(s: SiteSettings): ThemeDraft {
  return {
    colors: {
      themePrimary:    s.themePrimary    ?? '',
      themeSecondary:  s.themeSecondary  ?? '',
      themeBackground: s.themeBackground ?? '',
      themeForeground: s.themeForeground ?? '',
      themeCard:       s.themeCard       ?? '',
      themeMuted:      s.themeMuted      ?? '',
      themeAccent:     s.themeAccent     ?? '',
      themeBorder:     s.themeBorder     ?? '',
    },
    noiseOpacity:      s.noiseOpacity         ?? 0.04,
    crtEnabled:        s.crtScanlinesEnabled   ?? true,
    vignetteIntensity: s.vignetteIntensity     ?? 0.5,
    effects:           s.themeConfig?.effects  ?? {},
    heroFrom:          s.themeGradientHeroFrom   ?? '',
    heroTo:            s.themeGradientHeroTo     ?? '',
    heroDir:           s.themeGradientHeroDir    ?? '135deg',
    accentFrom:        s.themeGradientAccentFrom ?? '',
    accentTo:          s.themeGradientAccentTo   ?? '',
    accentDir:         s.themeGradientAccentDir  ?? '135deg',
    typography:        s.themeConfig?.typography ?? {},
    animPreset:        s.themeConfig?.animation.preset ?? 'slide-up',
    animDuration:      parseFloat(s.themeConfig?.animation.duration ?? '0.4') || 0.4,
    activeThemeId:     s.themeConfig?.themeId,
  }
}

/**
 * Builds a `:root { … }` CSS override string from the current draft.
 *
 * The result is rendered as an inline `<style data-id="ctm-live-preview">` tag
 * in the component JSX — no direct DOM mutation required.  React removes the
 * element on unmount, which naturally prevents color overrides from bleeding
 * into other pages after the admin navigates away.
 *
 * Returns an empty string when no overrides are needed (the style tag is
 * omitted in that case).
 */
function buildPreviewCss(draft: ThemeDraft): string {
  const rules: string[] = []

  if (Object.values(draft.colors).some((v) => v !== '')) {
    TOKEN_ROWS.forEach(({ key, cssVar, defaultHint }) => {
      rules.push(`  ${cssVar}: ${draft.colors[key] || defaultHint};`)
    })
  }

  if (draft.heroFrom && draft.heroTo) {
    rules.push(`  --gradient-hero: linear-gradient(${draft.heroDir || '135deg'}, ${draft.heroFrom}, ${draft.heroTo});`)
  }
  if (draft.accentFrom && draft.accentTo) {
    rules.push(`  --gradient-accent: linear-gradient(${draft.accentDir || '135deg'}, ${draft.accentFrom}, ${draft.accentTo});`)
  }

  // ── Typography ────────────────────────────────────────────────────────────
  const typo = draft.typography
  if (typo) {
    if (typo.fontFamily)    rules.push(`  --font-family-body: '${typo.fontFamily}', sans-serif;`)
    if (typo.headingFamily) rules.push(`  --font-family-heading: '${typo.headingFamily}', sans-serif;`)
    if (typo.headingSize)   rules.push(`  --heading-size: ${typo.headingSize};`)
    if (typo.bodySize)      rules.push(`  --body-size: ${typo.bodySize};`)
    if (typo.bodyWeight)    rules.push(`  --body-weight: ${typo.bodyWeight};`)
    if (typo.headingWeight) rules.push(`  --heading-weight: ${typo.headingWeight};`)
    if (typo.lineHeight)    rules.push(`  --line-height-body: ${typo.lineHeight};`)
    if (typo.letterSpacing) rules.push(`  --letter-spacing-body: ${typo.letterSpacing};`)
  }

  return rules.length > 0 ? `:root {\n${rules.join('\n')}\n}` : ''
}

function loadCustomPresets(): CustomColorPreset[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CUSTOM_PRESETS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as CustomColorPreset[]
  } catch {
    return []
  }
}

function saveCustomPresets(presets: CustomColorPreset[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets))
}

// ── Component ────────────────────────────────────────────────────────────────

export function ColorThemeManager({ value, onChange, isLoading = false }: ColorThemeManagerProps) {
  // ── Single atomic draft state (replaces 15+ useState/useRef pairs) ────────
  const [draft, dispatch] = useReducer(themeReducer, value, draftFromSettings)
  const [isSaving, setIsSaving] = useState(false)
  /** Snapshot of last-saved/persisted state, used to restore on Cancel. */
  const originalDraft = useRef<ThemeDraft>(draftFromSettings(value))

  // UI-only state (not part of the theme draft)
  const [customPresets, setCustomPresets] = useState<CustomColorPreset[]>(() => loadCustomPresets())
  const [newPresetName, setNewPresetName] = useState('')

  // Sync draft when the parent pushes a fresh `value` (e.g. after a remote save)
  useEffect(() => {
    const next = draftFromSettings(value)
    dispatch({ type: 'SET_DRAFT', draft: next })
    originalDraft.current = next
  }, [value])

  // ── Dynamically load Google Fonts for typography live-preview ────────────
  useEffect(() => {
    const fontsToLoad = new Set<string>()
    const { fontFamily, headingFamily } = draft.typography
    if (fontFamily && GOOGLE_FONT_URL_MAP[fontFamily])       fontsToLoad.add(fontFamily)
    if (headingFamily && GOOGLE_FONT_URL_MAP[headingFamily]) fontsToLoad.add(headingFamily)

    if (fontsToLoad.size === 0) return

    const families = Array.from(fontsToLoad).map((f) => GOOGLE_FONT_URL_MAP[f]).join('&family=')
    const href = `https://fonts.googleapis.com/css2?family=${families}&display=swap`

    const existingLink = document.head.querySelector('link[data-ctm-font]')
    if (existingLink) existingLink.remove()

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.setAttribute('data-ctm-font', 'true')
    document.head.appendChild(link)

    return () => {
      link.remove()
    }
  }, [draft.typography.fontFamily, draft.typography.headingFamily])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleColorChange = useCallback((key: keyof LegacyColors, val: string) => {
    dispatch({ type: 'SET_COLOR', key, value: val })
  }, [])

  const handleReset = useCallback((key: keyof LegacyColors) => {
    dispatch({ type: 'RESET_COLOR', key })
  }, [])

  const handlePreset = useCallback((preset: { colors: LegacyColors }) => {
    dispatch({ type: 'APPLY_COLORS', colors: preset.colors })
  }, [])

  /** Apply a complete ThemeConfig preset (from Themes tab). */
  const handleApplyTheme = useCallback((theme: ThemeConfig) => {
    dispatch({ type: 'APPLY_THEME', theme })
    toast.info(`"${theme.themeId ?? 'Preset'}" theme applied. Click Save Theme to persist.`)
  }, [])

  const handleCancel = useCallback(() => {
    dispatch({ type: 'SET_DRAFT', draft: originalDraft.current })
  }, [])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      // Merge legacy overlay values into effects.overlay for storage
      const mergedEffects: ThemeEffects = {
        ...draft.effects,
        overlay: {
          ...draft.effects.overlay,
          noiseOpacity:      draft.noiseOpacity,
          crtEnabled:        draft.crtEnabled,
          vignetteIntensity: draft.vignetteIntensity,
        },
      }

      const themeConfig: ThemeConfig = {
        colors: {
          primary:    draft.colors.themePrimary    ?? '',
          secondary:  draft.colors.themeSecondary  ?? '',
          background: draft.colors.themeBackground ?? '',
          foreground: draft.colors.themeForeground ?? '',
          card:       draft.colors.themeCard       ?? '',
          muted:      draft.colors.themeMuted      ?? '',
          accent:     draft.colors.themeAccent     ?? '',
          border:     draft.colors.themeBorder     ?? '',
        },
        gradients: {
          heroFrom:   draft.heroFrom,
          heroTo:     draft.heroTo,
          heroDir:    draft.heroDir,
          accentFrom: draft.accentFrom,
          accentTo:   draft.accentTo,
          accentDir:  draft.accentDir,
        },
        typography: draft.typography,
        glass:      value.themeConfig?.glass ?? {},
        animation: {
          preset:   draft.animPreset,
          duration: `${draft.animDuration}s`,
        },
        effects:  mergedEffects,
        themeId:  draft.activeThemeId,
      }
      await onChange({
        ...value,
        ...draft.colors,
        noiseOpacity:            draft.noiseOpacity,
        crtScanlinesEnabled:     draft.crtEnabled,
        vignetteIntensity:       draft.vignetteIntensity,
        themeGradientHeroFrom:   draft.heroFrom,
        themeGradientHeroTo:     draft.heroTo,
        themeGradientHeroDir:    draft.heroDir,
        themeGradientAccentFrom: draft.accentFrom,
        themeGradientAccentTo:   draft.accentTo,
        themeGradientAccentDir:  draft.accentDir,
        themeConfig,
      })
      originalDraft.current = { ...draft }
      toast.success('Color theme saved')
    } catch {
      toast.error('Failed to save color theme')
    } finally {
      setIsSaving(false)
    }
  }, [onChange, value, draft])

  // ── Custom preset management ──────────────────────────────────────────────

  function handleSaveCustomPreset() {
    const name = newPresetName.trim()
    if (!name) { toast.error('Enter a name for the preset'); return }
    const updated = [...customPresets.filter((p) => p.name !== name), { name, colors: draft.colors }]
    setCustomPresets(updated)
    saveCustomPresets(updated)
    setNewPresetName('')
    toast.success(`Preset "${name}" saved`)
  }

  function handleDeleteCustomPreset(name: string) {
    const updated = customPresets.filter((p) => p.name !== name)
    setCustomPresets(updated)
    saveCustomPresets(updated)
  }

  const disabled = isLoading || isSaving

  // ── Live-preview CSS ──────────────────────────────────────────────────────
  // Rendered as an inline <style> tag — no imperative DOM mutations needed.
  // React removes the element on unmount, preventing color bleed across pages.
  const previewCss = buildPreviewCss(draft)

  return (
    <>
      {previewCss && (
        <style data-id="ctm-live-preview" dangerouslySetInnerHTML={{ __html: previewCss }} />
      )}
      <div className="space-y-6">
      <Tabs defaultValue="themes">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="themes">Themes</TabsTrigger>
          <TabsTrigger value="colors">Colors</TabsTrigger>
          <TabsTrigger value="effects">Effects</TabsTrigger>
          <TabsTrigger value="gradients">Gradients</TabsTrigger>
          <TabsTrigger value="typography">Typography</TabsTrigger>
          <TabsTrigger value="animations">Animations</TabsTrigger>
          <TabsTrigger value="contrast">Contrast Check</TabsTrigger>
        </TabsList>

        {/* ── Themes Tab ──────────────────────────────────────────── */}
        <TabsContent value="themes">
          <ThemesTab
            currentThemeId={draft.activeThemeId}
            onApply={handleApplyTheme}
          />
        </TabsContent>

        {/* ── Colors Tab ──────────────────────────────────────────── */}
        <TabsContent value="colors" className="space-y-6">
          {/* Quick Color-only presets */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Quick Color Presets</p>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => (
                <Button key={preset.name} variant="outline" size="sm" onClick={() => handlePreset(preset)} disabled={disabled}>
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom saved presets */}
          {customPresets.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Custom Presets</p>
                <div className="flex flex-wrap gap-2">
                  {customPresets.map((preset) => (
                    <div key={preset.name} className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => handlePreset(preset)} disabled={disabled}>
                        {preset.name}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteCustomPreset(preset.name)}
                        aria-label={`Delete preset ${preset.name}`}
                        title={`Delete "${preset.name}"`}
                      >
                        <Trash size={13} aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Save current colors as custom preset */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Save Current Colors as Preset</p>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Preset name…"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCustomPreset() }}
                className="max-w-xs"
                disabled={disabled}
                aria-label="New preset name"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveCustomPreset}
                disabled={!newPresetName.trim()}
              >
                <BookmarkSimple size={14} className="mr-1.5" aria-hidden="true" />
                Save Preset
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Presets are stored in your browser&apos;s localStorage (per device).</p>
          </div>

          <Separator />

          {/* Token rows */}
          <div className="space-y-4">
            {TOKEN_ROWS.map(({ key, cssVar, label, defaultHint }) => {
              const current = draft.colors[key]
              const picker = current || defaultHint
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="h-9 w-9 rounded border border-border shadow-sm" style={{ backgroundColor: picker }} aria-hidden="true" />
                    <input
                      type="color"
                      id={`color-picker-${key}`}
                      value={picker}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                      disabled={disabled}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      aria-label={`${label} color picker`}
                    />
                  </div>
                  <div className="w-28 shrink-0">
                    <Label htmlFor={`color-hex-${key}`} className="text-sm font-medium">{label}</Label>
                    <p className="text-xs text-muted-foreground">{cssVar}</p>
                  </div>
                  <Input
                    id={`color-hex-${key}`}
                    type="text"
                    value={current}
                    onChange={(e) => handleColorChange(key, e.target.value)}
                    placeholder={defaultHint}
                    disabled={disabled}
                    className="max-w-[140px] font-mono text-sm"
                    aria-label={`${label} hex value`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleReset(key)}
                    disabled={disabled || current === ''}
                    title={`Reset ${label} to default`}
                    aria-label={`Reset ${label} to default`}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowCounterClockwise size={15} aria-hidden="true" />
                  </Button>
                </div>
              )
            })}
          </div>
        </TabsContent>

        {/* ── Effects Tab ─────────────────────────────────────────── */}
        <TabsContent value="effects">
          <EffectsTab
            noiseOpacity={draft.noiseOpacity}
            crtEnabled={draft.crtEnabled}
            vignetteIntensity={draft.vignetteIntensity}
            effects={draft.effects}
            onNoiseOpacity={(v) => dispatch({ type: 'SET_NOISE_OPACITY', value: v })}
            onCrtEnabled={(v) => dispatch({ type: 'SET_CRT', value: v })}
            onVignetteIntensity={(v) => dispatch({ type: 'SET_VIGNETTE', value: v })}
            onEffects={(e) => dispatch({ type: 'SET_EFFECTS', effects: e })}
            disabled={disabled}
          />
        </TabsContent>

        {/* ── Gradients Tab ───────────────────────────────────────── */}
        <TabsContent value="gradients" className="space-y-8">
          <p className="text-sm text-muted-foreground">
            Define gradient CSS variables (<code className="text-xs font-mono">--gradient-hero</code>, <code className="text-xs font-mono">--gradient-accent</code>)
            that can be referenced anywhere in the site via <code className="text-xs font-mono">var(--gradient-hero)</code>.
          </p>

          {/* Hero Gradient */}
          <div className="space-y-4">
            <p className="text-sm font-semibold">Hero Gradient <code className="text-xs font-mono text-muted-foreground">--gradient-hero</code></p>
            <GradientEditor
              from={draft.heroFrom} to={draft.heroTo} dir={draft.heroDir}
              onFrom={(v) => dispatch({ type: 'SET_HERO_FROM', value: v })}
              onTo={(v) => dispatch({ type: 'SET_HERO_TO', value: v })}
              onDir={(v) => dispatch({ type: 'SET_HERO_DIR', value: v })}
              disabled={disabled}
              directions={GRADIENT_DIRECTIONS}
              label="hero"
            />
          </div>

          <Separator />

          {/* Accent Gradient */}
          <div className="space-y-4">
            <p className="text-sm font-semibold">Accent Gradient <code className="text-xs font-mono text-muted-foreground">--gradient-accent</code></p>
            <GradientEditor
              from={draft.accentFrom} to={draft.accentTo} dir={draft.accentDir}
              onFrom={(v) => dispatch({ type: 'SET_ACCENT_FROM', value: v })}
              onTo={(v) => dispatch({ type: 'SET_ACCENT_TO', value: v })}
              onDir={(v) => dispatch({ type: 'SET_ACCENT_DIR', value: v })}
              disabled={disabled}
              directions={GRADIENT_DIRECTIONS}
              label="accent"
            />
          </div>
        </TabsContent>

        {/* ── Typography Tab ──────────────────────────────────────── */}
        <TabsContent value="typography">
          <TypographyTab
            typography={draft.typography}
            onChange={(t) => dispatch({ type: 'SET_TYPOGRAPHY', typography: t })}
            disabled={disabled}
          />
        </TabsContent>

        {/* ── Animations Tab ──────────────────────────────────────── */}
        <TabsContent value="animations" className="space-y-8">
          <p className="text-sm text-muted-foreground">
            Choose how pages and sections animate on entry and exit. All presets respect <code className="text-xs font-mono">prefers-reduced-motion</code>.
          </p>

          {/* Preset picker */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkle size={16} className="text-muted-foreground" aria-hidden="true" />
              <Label className="text-sm font-medium">Animation Preset</Label>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.keys(ANIMATION_PRESETS).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => dispatch({ type: 'SET_ANIM_PRESET', preset: key })}
                  disabled={disabled}
                  className={`rounded-md border px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                    draft.animPreset === key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground hover:border-primary/50'
                  }`}
                  aria-pressed={draft.animPreset === key}
                >
                  {ANIMATION_PRESET_LABELS[key] ?? key}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Duration */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkle size={16} className="text-muted-foreground" aria-hidden="true" />
              <Label className="text-sm font-medium">Animation Duration</Label>
            </div>
            <div className="flex items-center gap-4">
              <Slider
                min={0.1} max={1.2} step={0.05}
                value={[draft.animDuration]}
                onValueChange={([v]) => dispatch({ type: 'SET_ANIM_DURATION', duration: v })}
                disabled={disabled}
                className="flex-1"
                aria-label="Animation duration"
              />
              <span className="w-16 text-right font-mono text-sm text-muted-foreground">{draft.animDuration.toFixed(2)}s</span>
            </div>
            <p className="text-xs text-muted-foreground">CSS token: <code className="font-mono">--animation-duration</code>. Used by PageTransition and motion components.</p>
          </div>
        </TabsContent>

        {/* ── Contrast Check Tab ───────────────────────────────────── */}
        <TabsContent value="contrast" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            WCAG 2.1 contrast ratios for all key color pairs. AA requires ≥ 4.5:1 for normal text, ≥ 3:1 for large text / UI components.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Pair</th>
                  <th className="py-2 pr-4 font-medium">Ratio</th>
                  <th className="py-2 pr-4 font-medium">AA Normal</th>
                  <th className="py-2 font-medium">AA Large / UI</th>
                </tr>
              </thead>
              <tbody>
                {CONTRAST_PAIRS.map(({ label, fg, bg, fgHint, bgHint }) => {
                  const fgColor = (draft.colors[fg as keyof LegacyColors] || fgHint)
                  const bgColor = (draft.colors[bg as keyof LegacyColors] || bgHint)
                  const ratio = contrastRatio(fgColor, bgColor)
                  const aaPass = ratio !== null && ratio >= 4.5
                  const aaBigPass = ratio !== null && ratio >= 3
                  return (
                    <tr key={label} className="border-b border-border/50">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex h-5 w-10 rounded border border-border overflow-hidden shrink-0"
                            aria-hidden="true"
                          >
                            <span className="flex-1" style={{ background: bgColor }} />
                            <span className="flex-1" style={{ background: fgColor }} />
                          </span>
                          {label}
                        </div>
                      </td>
                      <td className="py-2 pr-4 font-mono">{ratio !== null ? `${ratio.toFixed(2)}:1` : '—'}</td>
                      <td className="py-2 pr-4">
                        {ratio !== null ? (
                          aaPass
                            ? <span className="flex items-center gap-1 text-emerald-400"><CheckCircle size={14} aria-hidden="true" />Pass</span>
                            : <span className="flex items-center gap-1 text-yellow-400"><Warning size={14} aria-hidden="true" />Fail<span className="sr-only"> — below the WCAG AA minimum</span></span>
                        ) : '—'}
                      </td>
                      <td className="py-2">
                        {ratio !== null ? (
                          aaBigPass
                            ? <span className="flex items-center gap-1 text-emerald-400"><CheckCircle size={14} aria-hidden="true" />Pass</span>
                            : <span className="flex items-center gap-1 text-yellow-400"><Warning size={14} aria-hidden="true" />Fail</span>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <Separator />

      {/* Action buttons — shared across all tabs */}
      <div className="flex items-center gap-3">
        <Button onClick={() => void handleSave()} disabled={disabled}>
          <FloppyDisk size={16} className="mr-2" aria-hidden="true" />
          {isSaving ? 'Saving…' : 'Save Theme'}
        </Button>
        <Button variant="outline" onClick={handleCancel} disabled={disabled}>
          <X size={16} className="mr-2" aria-hidden="true" />
          Cancel
        </Button>
      </div>
    </div>
    </>
  )
}

// ── Gradient Editor sub-component ────────────────────────────────────────────

interface GradientEditorProps {
  from: string
  to: string
  dir: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
  onDir: (v: string) => void
  disabled: boolean
  directions: { value: string; label: string }[]
  label: string
}

function GradientEditor({ from, to, dir, onFrom, onTo, onDir, disabled, directions, label }: GradientEditorProps) {
  const previewStyle = from && to
    ? { background: `linear-gradient(${dir || '135deg'}, ${from}, ${to})` }
    : { background: 'transparent', border: '1px dashed var(--border)' }

  return (
    <div className="space-y-3">
      {/* Live preview swatch */}
      <div
        className="h-12 w-full rounded-md"
        style={previewStyle}
        aria-label={`${label} gradient preview`}
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">From color</Label>
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <div className="h-8 w-8 rounded border border-border" style={{ backgroundColor: from || '#101010' }} aria-hidden="true" />
              <input
                type="color"
                value={from || '#101010'}
                onChange={(e) => onFrom(e.target.value)}
                disabled={disabled}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label={`${label} gradient from color`}
              />
            </div>
            <Input
              type="text"
              value={from}
              onChange={(e) => onFrom(e.target.value)}
              placeholder="#101010"
              disabled={disabled}
              className="font-mono text-sm"
              aria-label={`${label} gradient from hex`}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">To color</Label>
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <div className="h-8 w-8 rounded border border-border" style={{ backgroundColor: to || '#ffffff' }} aria-hidden="true" />
              <input
                type="color"
                value={to || '#ffffff'}
                onChange={(e) => onTo(e.target.value)}
                disabled={disabled}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label={`${label} gradient to color`}
              />
            </div>
            <Input
              type="text"
              value={to}
              onChange={(e) => onTo(e.target.value)}
              placeholder="#ffffff"
              disabled={disabled}
              className="font-mono text-sm"
              aria-label={`${label} gradient to hex`}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Direction</Label>
        <select
          value={dir}
          onChange={(e) => onDir(e.target.value)}
          disabled={disabled}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={`${label} gradient direction`}
        >
          {directions.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
          <option value="custom">Custom angle…</option>
        </select>
        {!directions.some((d) => d.value === dir) && (
          <Input
            type="text"
            value={dir}
            onChange={(e) => onDir(e.target.value)}
            placeholder="e.g. 45deg or to bottom right"
            disabled={disabled}
            className="font-mono text-sm mt-1"
            aria-label={`${label} gradient custom direction`}
          />
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { onFrom(''); onTo(''); onDir('135deg') }}
          disabled={disabled || (!from && !to)}
          className="text-muted-foreground"
        >
          <ArrowCounterClockwise size={14} className="mr-1" aria-hidden="true" />
          Clear gradient
        </Button>
      </div>
    </div>
  )
}
