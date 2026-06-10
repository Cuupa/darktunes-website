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
 */

import { useCallback, useEffect, useRef, useState } from 'react'
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
import type { ThemeConfig, ThemeEffects } from '@/config/themeConfig'
import { EffectsTab } from '@/components/admin/theme-tabs/EffectsTab'
import { TypographyTab } from '@/components/admin/theme-tabs/TypographyTab'
import { ThemesTab } from '@/components/admin/theme-tabs/ThemesTab'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ColorThemeManagerProps {
  value: SiteSettings
  onChange: (updated: SiteSettings) => Promise<void>
  isLoading?: boolean
}

type ThemeColors = ThemePresetColors

interface TokenRow {
  key: keyof ThemeColors
  cssVar: string
  label: string
  defaultHint: string
}

interface CustomColorPreset {
  name: string
  colors: ThemeColors
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

function extractColors(s: SiteSettings): ThemeColors {
  return {
    themePrimary:    s.themePrimary    ?? '',
    themeSecondary:  s.themeSecondary  ?? '',
    themeBackground: s.themeBackground ?? '',
    themeForeground: s.themeForeground ?? '',
    themeCard:       s.themeCard       ?? '',
    themeMuted:      s.themeMuted      ?? '',
    themeAccent:     s.themeAccent     ?? '',
    themeBorder:     s.themeBorder     ?? '',
  }
}

function applyLive(colors: ThemeColors) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  TOKEN_ROWS.forEach(({ key, cssVar, defaultHint }) => {
    root.style.setProperty(cssVar, colors[key] || defaultHint)
  })
}

function removeLive() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  TOKEN_ROWS.forEach(({ cssVar }) => root.style.removeProperty(cssVar))
  // Also remove gradient inline overrides so they don't outlive the component
  root.style.removeProperty('--gradient-hero')
  root.style.removeProperty('--gradient-accent')
}

function applyGradientLive(heroFrom: string, heroTo: string, heroDir: string, accentFrom: string, accentTo: string, accentDir: string) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (heroFrom && heroTo) {
    root.style.setProperty('--gradient-hero', `linear-gradient(${heroDir || '135deg'}, ${heroFrom}, ${heroTo})`)
  }
  if (accentFrom && accentTo) {
    root.style.setProperty('--gradient-accent', `linear-gradient(${accentDir || '135deg'}, ${accentFrom}, ${accentTo})`)
  }
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
  const [colors, setColors] = useState<ThemeColors>(() => extractColors(value))
  const [isSaving, setIsSaving] = useState(false)
  const originalColors = useRef<ThemeColors>(extractColors(value))

  // Effects state — legacy flat fields
  const [noiseOpacity, setNoiseOpacity] = useState(() => value.noiseOpacity ?? 0.04)
  const [crtEnabled, setCrtEnabled] = useState(() => value.crtScanlinesEnabled ?? true)
  const [vignetteIntensity, setVignetteIntensity] = useState(() => value.vignetteIntensity ?? 0.5)
  const originalEffects = useRef({ noiseOpacity: value.noiseOpacity ?? 0.04, crtEnabled: value.crtScanlinesEnabled ?? true, vignetteIntensity: value.vignetteIntensity ?? 0.5 })

  // Extended effects state (ThemeEffects)
  const [effects, setEffects] = useState<ThemeEffects>(() => value.themeConfig?.effects ?? {})
  const originalExtEffects = useRef<ThemeEffects>(value.themeConfig?.effects ?? {})

  // Gradient state
  const [gradientHeroFrom, setGradientHeroFrom] = useState(() => value.themeGradientHeroFrom ?? '')
  const [gradientHeroTo, setGradientHeroTo] = useState(() => value.themeGradientHeroTo ?? '')
  const [gradientHeroDir, setGradientHeroDir] = useState(() => value.themeGradientHeroDir ?? '135deg')
  const [gradientAccentFrom, setGradientAccentFrom] = useState(() => value.themeGradientAccentFrom ?? '')
  const [gradientAccentTo, setGradientAccentTo] = useState(() => value.themeGradientAccentTo ?? '')
  const [gradientAccentDir, setGradientAccentDir] = useState(() => value.themeGradientAccentDir ?? '135deg')
  const originalGradients = useRef({ gradientHeroFrom: value.themeGradientHeroFrom ?? '', gradientHeroTo: value.themeGradientHeroTo ?? '', gradientHeroDir: value.themeGradientHeroDir ?? '135deg', gradientAccentFrom: value.themeGradientAccentFrom ?? '', gradientAccentTo: value.themeGradientAccentTo ?? '', gradientAccentDir: value.themeGradientAccentDir ?? '135deg' })

  // Typography state — driven by ThemeTypography object
  const [typography, setTypography] = useState(() => value.themeConfig?.typography ?? {})
  const originalTypography = useRef(value.themeConfig?.typography ?? {})

  // Animation state
  const [animPreset, setAnimPreset] = useState(() => value.themeConfig?.animation.preset ?? 'slide-up')
  const [animDuration, setAnimDuration] = useState(() => {
    const raw = value.themeConfig?.animation.duration ?? '0.4s'
    return parseFloat(raw) || 0.4
  })
  const originalAnimation = useRef({ animPreset: value.themeConfig?.animation.preset ?? 'slide-up', animDuration: parseFloat(value.themeConfig?.animation.duration ?? '0.4') || 0.4 })

  // Current theme ID (for Themes tab active highlighting)
  const [activeThemeId, setActiveThemeId] = useState(() => value.themeConfig?.themeId)

  // Custom color presets (localStorage)
  const [customPresets, setCustomPresets] = useState<CustomColorPreset[]>(() => loadCustomPresets())
  const [newPresetName, setNewPresetName] = useState('')

  useEffect(() => {
    const fresh = extractColors(value)
    setColors(fresh)
    originalColors.current = fresh
    const e = { noiseOpacity: value.noiseOpacity ?? 0.04, crtEnabled: value.crtScanlinesEnabled ?? true, vignetteIntensity: value.vignetteIntensity ?? 0.5 }
    setNoiseOpacity(e.noiseOpacity)
    setCrtEnabled(e.crtEnabled)
    setVignetteIntensity(e.vignetteIntensity)
    originalEffects.current = e
    const extFx = value.themeConfig?.effects ?? {}
    setEffects(extFx)
    originalExtEffects.current = extFx
    const g = { gradientHeroFrom: value.themeGradientHeroFrom ?? '', gradientHeroTo: value.themeGradientHeroTo ?? '', gradientHeroDir: value.themeGradientHeroDir ?? '135deg', gradientAccentFrom: value.themeGradientAccentFrom ?? '', gradientAccentTo: value.themeGradientAccentTo ?? '', gradientAccentDir: value.themeGradientAccentDir ?? '135deg' }
    setGradientHeroFrom(g.gradientHeroFrom)
    setGradientHeroTo(g.gradientHeroTo)
    setGradientHeroDir(g.gradientHeroDir)
    setGradientAccentFrom(g.gradientAccentFrom)
    setGradientAccentTo(g.gradientAccentTo)
    setGradientAccentDir(g.gradientAccentDir)
    originalGradients.current = g
    const typo = value.themeConfig?.typography ?? {}
    setTypography(typo)
    originalTypography.current = typo
    const ap = value.themeConfig?.animation.preset ?? 'slide-up'
    const ad = parseFloat(value.themeConfig?.animation.duration ?? '0.4') || 0.4
    setAnimPreset(ap)
    setAnimDuration(ad)
    originalAnimation.current = { animPreset: ap, animDuration: ad }
    setActiveThemeId(value.themeConfig?.themeId)
  }, [value])

  // Live-preview colors in admin (doesn't affect public site until Save).
  // The cleanup removes all inline overrides on unmount so they never bleed
  // into other pages when the admin navigates away via client-side routing.
  useEffect(() => {
    if (Object.values(colors).some((v) => v !== '')) {
      applyLive(colors)
    } else {
      removeLive()
    }
    applyGradientLive(gradientHeroFrom, gradientHeroTo, gradientHeroDir, gradientAccentFrom, gradientAccentTo, gradientAccentDir)
    return () => { removeLive() }
  }, [colors, gradientHeroFrom, gradientHeroTo, gradientHeroDir, gradientAccentFrom, gradientAccentTo, gradientAccentDir])

  const handleColorChange = useCallback((key: keyof ThemeColors, val: string) => {
    setColors((prev) => ({ ...prev, [key]: val }))
  }, [])

  const handleReset = useCallback((key: keyof ThemeColors) => {
    setColors((prev) => ({ ...prev, [key]: '' }))
  }, [])

  const handlePreset = useCallback((preset: { colors: ThemeColors }) => {
    setColors(preset.colors)
  }, [])

  /** Apply a complete ThemeConfig preset (from Themes tab). */
  const handleApplyTheme = useCallback((theme: ThemeConfig) => {
    setColors({
      themePrimary:    theme.colors.primary,
      themeSecondary:  theme.colors.secondary,
      themeBackground: theme.colors.background,
      themeForeground: theme.colors.foreground,
      themeCard:       theme.colors.card,
      themeMuted:      theme.colors.muted,
      themeAccent:     theme.colors.accent,
      themeBorder:     theme.colors.border,
    })
    setGradientHeroFrom(theme.gradients.heroFrom ?? '')
    setGradientHeroTo(theme.gradients.heroTo ?? '')
    setGradientHeroDir(theme.gradients.heroDir ?? '135deg')
    setGradientAccentFrom(theme.gradients.accentFrom ?? '')
    setGradientAccentTo(theme.gradients.accentTo ?? '')
    setGradientAccentDir(theme.gradients.accentDir ?? '135deg')
    setTypography(theme.typography)
    setAnimPreset(theme.animation.preset ?? 'slide-up')
    setAnimDuration(parseFloat(theme.animation.duration ?? '0.4') || 0.4)
    if (theme.effects) {
      setEffects(theme.effects)
      // Sync legacy flat fields from theme effects if present
      setNoiseOpacity(theme.effects.overlay?.noiseOpacity ?? 0.04)
      setCrtEnabled(theme.effects.overlay?.crtEnabled ?? false)
      setVignetteIntensity(theme.effects.overlay?.vignetteIntensity ?? 0.5)
    }
    setActiveThemeId(theme.themeId)
    toast.info(`"${theme.themeId ?? 'Preset'}" theme applied. Click Save Theme to persist.`)
  }, [])

  const handleCancel = useCallback(() => {
    setColors(originalColors.current)
    applyLive(originalColors.current)
    if (Object.values(originalColors.current).every((v) => v === '')) removeLive()
    setNoiseOpacity(originalEffects.current.noiseOpacity)
    setCrtEnabled(originalEffects.current.crtEnabled)
    setVignetteIntensity(originalEffects.current.vignetteIntensity)
    setEffects(originalExtEffects.current)
    const g = originalGradients.current
    setGradientHeroFrom(g.gradientHeroFrom)
    setGradientHeroTo(g.gradientHeroTo)
    setGradientHeroDir(g.gradientHeroDir)
    setGradientAccentFrom(g.gradientAccentFrom)
    setGradientAccentTo(g.gradientAccentTo)
    setGradientAccentDir(g.gradientAccentDir)
    setTypography(originalTypography.current)
    setAnimPreset(originalAnimation.current.animPreset)
    setAnimDuration(originalAnimation.current.animDuration)
    setActiveThemeId(value.themeConfig?.themeId)
  }, [value])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      // Merge legacy overlay values into effects.overlay for storage
      const mergedEffects: ThemeEffects = {
        ...effects,
        overlay: {
          ...effects.overlay,
          noiseOpacity,
          crtEnabled,
          vignetteIntensity,
        },
      }

      const themeConfig: ThemeConfig = {
        colors: {
          primary:    colors.themePrimary    ?? '',
          secondary:  colors.themeSecondary  ?? '',
          background: colors.themeBackground ?? '',
          foreground: colors.themeForeground ?? '',
          card:       colors.themeCard       ?? '',
          muted:      colors.themeMuted      ?? '',
          accent:     colors.themeAccent     ?? '',
          border:     colors.themeBorder     ?? '',
        },
        gradients: {
          heroFrom:   gradientHeroFrom,
          heroTo:     gradientHeroTo,
          heroDir:    gradientHeroDir,
          accentFrom: gradientAccentFrom,
          accentTo:   gradientAccentTo,
          accentDir:  gradientAccentDir,
        },
        typography,
        glass: value.themeConfig?.glass ?? {},
        animation: {
          preset:   animPreset,
          duration: `${animDuration}s`,
        },
        effects: mergedEffects,
        themeId: activeThemeId,
      }
      await onChange({
        ...value,
        ...colors,
        noiseOpacity,
        crtScanlinesEnabled: crtEnabled,
        vignetteIntensity,
        themeGradientHeroFrom: gradientHeroFrom,
        themeGradientHeroTo: gradientHeroTo,
        themeGradientHeroDir: gradientHeroDir,
        themeGradientAccentFrom: gradientAccentFrom,
        themeGradientAccentTo: gradientAccentTo,
        themeGradientAccentDir: gradientAccentDir,
        themeConfig,
      })
      originalColors.current = { ...colors }
      originalEffects.current = { noiseOpacity, crtEnabled, vignetteIntensity }
      originalExtEffects.current = mergedEffects
      originalGradients.current = { gradientHeroFrom, gradientHeroTo, gradientHeroDir, gradientAccentFrom, gradientAccentTo, gradientAccentDir }
      originalTypography.current = typography
      originalAnimation.current = { animPreset, animDuration }
      toast.success('Color theme saved')
    } catch {
      toast.error('Failed to save color theme')
    } finally {
      setIsSaving(false)
    }
  }, [onChange, value, colors, noiseOpacity, crtEnabled, vignetteIntensity, effects, gradientHeroFrom, gradientHeroTo, gradientHeroDir, gradientAccentFrom, gradientAccentTo, gradientAccentDir, typography, animPreset, animDuration, activeThemeId])

  // ── Custom preset management ─────────────────────────────────────────────

  function handleSaveCustomPreset() {
    const name = newPresetName.trim()
    if (!name) { toast.error('Enter a name for the preset'); return }
    const updated = [...customPresets.filter((p) => p.name !== name), { name, colors }]
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

  return (
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
            currentThemeId={activeThemeId}
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
              const current = colors[key]
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
            noiseOpacity={noiseOpacity}
            crtEnabled={crtEnabled}
            vignetteIntensity={vignetteIntensity}
            effects={effects}
            onNoiseOpacity={setNoiseOpacity}
            onCrtEnabled={setCrtEnabled}
            onVignetteIntensity={setVignetteIntensity}
            onEffects={setEffects}
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
              from={gradientHeroFrom} to={gradientHeroTo} dir={gradientHeroDir}
              onFrom={setGradientHeroFrom} onTo={setGradientHeroTo} onDir={setGradientHeroDir}
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
              from={gradientAccentFrom} to={gradientAccentTo} dir={gradientAccentDir}
              onFrom={setGradientAccentFrom} onTo={setGradientAccentTo} onDir={setGradientAccentDir}
              disabled={disabled}
              directions={GRADIENT_DIRECTIONS}
              label="accent"
            />
          </div>
        </TabsContent>

        {/* ── Typography Tab ──────────────────────────────────────── */}
        <TabsContent value="typography">
          <TypographyTab
            typography={typography}
            onChange={setTypography}
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
                  onClick={() => setAnimPreset(key)}
                  disabled={disabled}
                  className={`rounded-md border px-3 py-2 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                    animPreset === key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground hover:border-primary/50'
                  }`}
                  aria-pressed={animPreset === key}
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
                value={[animDuration]}
                onValueChange={([v]) => setAnimDuration(v)}
                disabled={disabled}
                className="flex-1"
                aria-label="Animation duration"
              />
              <span className="w-16 text-right font-mono text-sm text-muted-foreground">{animDuration.toFixed(2)}s</span>
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
                  const fgColor = (colors[fg as keyof ThemeColors] || fgHint)
                  const bgColor = (colors[bg as keyof ThemeColors] || bgHint)
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
