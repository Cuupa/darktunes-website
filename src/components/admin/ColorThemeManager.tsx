'use client'

/**
 * src/components/admin/ColorThemeManager.tsx
 *
 * Admin panel for customising the site's design-token color palette.
 *
 * Features:
 *  - 8 color rows, one per CSS custom property token
 *  - Native <input type="color"> picker + hex text input kept in sync
 *  - Per-row "Reset" button that clears the override (falls back to globals.css)
 *  - Live preview: changes are applied immediately to document.documentElement
 *    so the admin sees the site re-skin in real time
 *  - On cancel, original CSS property values are restored
 *  - 4 built-in palette presets for quick theming
 *  - WCAG contrast warning when background/foreground contrast < 4.5:1
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { RotateCcw, FloppyDisk, X, Warning } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import type { SiteSettings } from '@/types'
import { COLOR_PRESETS } from '@/config/colorPresets'
import type { ThemePresetColors } from '@/config/colorPresets'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ColorThemeManagerProps {
  value: SiteSettings
  onChange: (updated: SiteSettings) => Promise<void>
  isLoading?: boolean
}

// Use the shared ThemePresetColors type (also matches what TOKEN_ROWS keys need)
type ThemeColors = ThemePresetColors

interface TokenRow {
  key: keyof ThemeColors
  cssVar: string
  label: string
  defaultHint: string
}

// ── Token definitions ────────────────────────────────────────────────────────

/** Defaults from globals.css — shown as placeholder hints */
const TOKEN_ROWS: TokenRow[] = [
  { key: 'themePrimary',    cssVar: '--primary',    label: 'Primary',    defaultHint: '#493687' },
  { key: 'themeSecondary',  cssVar: '--secondary',  label: 'Secondary',  defaultHint: '#7e1e37' },
  { key: 'themeBackground', cssVar: '--background', label: 'Background', defaultHint: '#101010' },
  { key: 'themeForeground', cssVar: '--foreground', label: 'Foreground', defaultHint: '#ffffff' },
  { key: 'themeCard',       cssVar: '--card',       label: 'Card',       defaultHint: '#292929' },
  { key: 'themeMuted',      cssVar: '--muted',      label: 'Muted',      defaultHint: '#292929' },
  { key: 'themeAccent',     cssVar: '--accent',     label: 'Accent',     defaultHint: '#493687' },
  { key: 'themeBorder',     cssVar: '--border',     label: 'Border',     defaultHint: '#383838' },
]

// ── WCAG contrast helpers ────────────────────────────────────────────────────

/** Parse a 3- or 6-digit hex string to [r, g, b] in 0–255 range. */
function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '')
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16)
    const g = parseInt(clean[1] + clean[1], 16)
    const b = parseInt(clean[2] + clean[2], 16)
    return [r, g, b]
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16)
    const g = parseInt(clean.slice(2, 4), 16)
    const b = parseInt(clean.slice(4, 6), 16)
    return [r, g, b]
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

/** Apply a ThemeColors object as live CSS custom properties on <html>. */
function applyLive(colors: ThemeColors) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  TOKEN_ROWS.forEach(({ key, cssVar, defaultHint }) => {
    const v = colors[key]
    root.style.setProperty(cssVar, v || defaultHint)
  })
}

/** Remove inline overrides, letting globals.css take over. */
function removeLive() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  TOKEN_ROWS.forEach(({ cssVar }) => root.style.removeProperty(cssVar))
}

// ── Component ────────────────────────────────────────────────────────────────

export function ColorThemeManager({ value, onChange, isLoading = false }: ColorThemeManagerProps) {
  const [colors, setColors] = useState<ThemeColors>(() => extractColors(value))
  const [isSaving, setIsSaving] = useState(false)
  // Snapshot taken on mount so we can restore on cancel
  const originalColors = useRef<ThemeColors>(extractColors(value))

  // Keep local state in sync if parent re-fetches settings
  useEffect(() => {
    const fresh = extractColors(value)
    setColors(fresh)
    originalColors.current = fresh
  }, [value])

  // Apply live preview whenever colors change
  useEffect(() => {
    applyLive(colors)
  }, [colors])

  const handleColorChange = useCallback((key: keyof ThemeColors, newValue: string) => {
    setColors((prev) => ({ ...prev, [key]: newValue }))
  }, [])

  const handleReset = useCallback((key: keyof ThemeColors) => {
    setColors((prev) => ({ ...prev, [key]: '' }))
  }, [])

  const handlePreset = useCallback((preset: { colors: ThemeColors }) => {
    setColors(preset.colors)
  }, [])

  const handleCancel = useCallback(() => {
    setColors(originalColors.current)
    applyLive(originalColors.current)
    // If all originals are empty, remove inline overrides so globals.css wins
    const allEmpty = Object.values(originalColors.current).every((v) => v === '')
    if (allEmpty) removeLive()
  }, [])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await onChange({ ...value, ...colors })
      originalColors.current = { ...colors }
      toast.success('Color theme saved')
    } catch {
      toast.error('Failed to save color theme')
    } finally {
      setIsSaving(false)
    }
  }, [onChange, value, colors])

  // WCAG contrast check
  const bg = colors.themeBackground || '#101010'
  const fg = colors.themeForeground || '#ffffff'
  const ratio = contrastRatio(bg, fg)
  const contrastFail = ratio !== null && ratio < 4.5

  return (
    <div className="space-y-6">
      {/* Preset palette buttons */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Quick Presets</p>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((preset) => (
            <Button
              key={preset.name}
              variant="outline"
              size="sm"
              onClick={() => handlePreset(preset)}
              disabled={isLoading || isSaving}
            >
              {preset.name}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      {/* WCAG contrast warning */}
      {contrastFail && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-400">
          <Warning size={16} aria-hidden="true" className="shrink-0" />
          <span>
            Background / Foreground contrast ratio is{' '}
            <strong>{ratio!.toFixed(2)}:1</strong> — below the WCAG AA minimum
            of 4.5:1 for normal text.
          </span>
        </div>
      )}

      {/* Color token rows */}
      <div className="space-y-4">
        {TOKEN_ROWS.map(({ key, cssVar, label, defaultHint }) => {
          const currentValue = colors[key]
          const pickerValue = currentValue || defaultHint
          return (
            <div key={key} className="flex items-center gap-3">
              {/* Color swatch + native picker */}
              <div className="relative shrink-0">
                <div
                  className="h-9 w-9 rounded border border-border shadow-sm"
                  style={{ backgroundColor: pickerValue }}
                  aria-hidden="true"
                />
                <input
                  type="color"
                  id={`color-picker-${key}`}
                  value={pickerValue}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  disabled={isLoading || isSaving}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label={`${label} color picker`}
                />
              </div>

              {/* Label + CSS var hint */}
              <div className="w-28 shrink-0">
                <Label htmlFor={`color-hex-${key}`} className="text-sm font-medium">
                  {label}
                </Label>
                <p className="text-xs text-muted-foreground">{cssVar}</p>
              </div>

              {/* Hex text input */}
              <Input
                id={`color-hex-${key}`}
                type="text"
                value={currentValue}
                onChange={(e) => handleColorChange(key, e.target.value)}
                placeholder={defaultHint}
                disabled={isLoading || isSaving}
                className="max-w-[140px] font-mono text-sm"
                aria-label={`${label} hex value`}
              />

              {/* Reset button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleReset(key)}
                disabled={isLoading || isSaving || currentValue === ''}
                title={`Reset ${label} to default`}
                aria-label={`Reset ${label} to default`}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw size={15} aria-hidden="true" />
              </Button>
            </div>
          )
        })}
      </div>

      <Separator />

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => void handleSave()}
          disabled={isLoading || isSaving}
        >
          <FloppyDisk size={16} className="mr-2" aria-hidden="true" />
          {isSaving ? 'Saving…' : 'Save Theme'}
        </Button>
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isLoading || isSaving}
        >
          <X size={16} className="mr-2" aria-hidden="true" />
          Cancel
        </Button>
      </div>
    </div>
  )
}
