'use client'

/**
 * src/components/admin/theme-tabs/ThemesTab.tsx
 *
 * Full-theme presets tab — one-click apply of a complete look-and-feel.
 *
 * Shows the 6 signature themes prominently (DarkTunes, HipHop, Metal,
 * Cyberpunk, Synthwave, FutureWhite) and the 20 general color/style presets.
 *
 * Applying a theme overwrites ALL current settings (colors, gradients,
 * typography, glass, animation, effects).  A confirmation banner is shown
 * before the change is committed.
 */

import { useState } from 'react'
import { CheckCircle, Warning } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SIGNATURE_THEMES, SIGNATURE_THEME_META } from '@/config/themePresets'
import { THEME_PRESETS, THEME_PRESET_LABELS } from '@/config/themePresets'
import type { ThemeConfig } from '@/config/themeConfig'

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ThemesTabProps {
  currentThemeId: string | undefined
  onApply: (theme: ThemeConfig) => void
}

// ── Components ────────────────────────────────────────────────────────────────

interface SignatureCardProps {
  id: string
  theme: ThemeConfig
  meta: { label: string; description: string; emoji: string }
  isActive: boolean
  onApply: (theme: ThemeConfig) => void
}

function SignatureCard({ theme, meta, isActive, onApply }: SignatureCardProps) {
  const [confirming, setConfirming] = useState(false)

  const primary    = theme.colors.primary    || '#493687'
  const secondary  = theme.colors.secondary  || '#7e1e37'
  const background = theme.colors.background || '#101010'
  const foreground = theme.colors.foreground || '#ffffff'
  const accent     = theme.colors.accent     || '#493687'

  function handleClick() {
    if (confirming) {
      onApply(theme)
      setConfirming(false)
    } else {
      setConfirming(true)
    }
  }

  return (
    <div
      className={`relative rounded-xl border-2 overflow-hidden transition-all duration-200 ${
        isActive
          ? 'border-primary shadow-lg shadow-primary/20'
          : 'border-border hover:border-muted-foreground/40'
      }`}
    >
      {/* Colour swatch header */}
      <div
        className="h-20 w-full flex items-end p-3 gap-1"
        style={{
          background: `linear-gradient(135deg, ${background} 0%, ${primary}33 100%)`,
        }}
      >
        {[primary, secondary, accent, foreground + '80', background].map((c, i) => (
          <div
            key={i}
            className="w-5 h-5 rounded-full border border-white/10 shrink-0"
            style={{ background: c }}
            aria-hidden="true"
          />
        ))}
        {isActive && (
          <CheckCircle
            size={18}
            weight="fill"
            className="ml-auto text-primary"
            aria-label="Active theme"
          />
        )}
      </div>

      {/* Info */}
      <div className="p-4 space-y-1 bg-card">
        <p className="text-base font-semibold flex items-center gap-2">
          <span aria-hidden="true">{meta.emoji}</span>
          {meta.label}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">{meta.description}</p>

        {/* Font & animation badges */}
        <div className="flex flex-wrap gap-1 pt-1">
          {theme.typography.fontFamily && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {theme.typography.fontFamily}
            </span>
          )}
          {theme.animation.preset && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {theme.animation.preset}
            </span>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="px-4 pb-4 bg-card">
        {confirming ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <Warning size={14} aria-hidden="true" />
              This will overwrite all current theme settings.
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={handleClick}>
                Apply Theme
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant={isActive ? 'outline' : 'default'}
            className="w-full"
            onClick={handleClick}
            disabled={isActive}
          >
            {isActive ? 'Active' : 'Apply Theme'}
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ThemesTab({ currentThemeId, onApply }: ThemesTabProps) {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Apply a complete theme — colours, typography, effects, and animations — in one click.
          Applying overwrites all current theme settings; your changes are not saved automatically.
        </p>
        <p className="text-xs text-amber-400/80 flex items-center gap-1.5 pt-1">
          <Warning size={13} aria-hidden="true" />
          Click <strong>Save Theme</strong> after applying to persist the change.
        </p>
      </div>

      {/* ── Signature Themes ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Signature Themes
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(SIGNATURE_THEMES).map(([id, theme]) => {
            const meta = SIGNATURE_THEME_META[id]
            if (!meta) return null
            return (
              <SignatureCard
                key={id}
                id={id}
                theme={theme}
                meta={meta}
                isActive={currentThemeId === id}
                onApply={onApply}
              />
            )
          })}
        </div>
      </div>

      <Separator />

      {/* ── General Presets ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          General Colour Presets
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Object.entries(THEME_PRESETS).map(([id, theme]) => {
            const label    = THEME_PRESET_LABELS[id] ?? id
            const primary  = theme.colors.primary    || '#493687'
            const bg       = theme.colors.background || '#101010'
            const accent   = theme.colors.accent     || '#493687'
            const isActive = currentThemeId === id
            return (
              <button
                key={id}
                onClick={() => onApply(theme)}
                className={`rounded-lg border p-2 text-left space-y-2 transition-all hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive ? 'border-primary' : 'border-border'
                }`}
                title={`Apply "${label}" preset`}
              >
                <div
                  className="h-8 rounded-sm w-full"
                  style={{ background: `linear-gradient(135deg, ${bg} 0%, ${primary} 60%, ${accent} 100%)` }}
                  aria-hidden="true"
                />
                <p className="text-xs font-medium truncate">{label}</p>
                {isActive && (
                  <CheckCircle size={12} weight="fill" className="text-primary" aria-hidden="true" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
