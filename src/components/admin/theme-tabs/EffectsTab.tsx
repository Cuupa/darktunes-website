'use client'

/**
 * src/components/admin/theme-tabs/EffectsTab.tsx
 *
 * Effects tab for the Color Theme Manager.
 *
 * Renders all toggleable visual effects grouped by category:
 *  - Overlay  : noise, scanlines, vignette, chromatic aberration, colour wash
 *  - Image/Hover: hover zoom, 3D tilt, hover glow, card scale, card lift
 *  - Text     : heading glow, heading shimmer
 *  - UI       : border pulse, button ripple, scroll reveal
 *  - Custom CSS: raw CSS textarea
 *
 * Each effect is independently toggleable; disabled effects consume zero
 * resources (no CSS animations running, data-fx attributes absent from <html>).
 */

import React from 'react'
import {
  FilmStrip,
  Monitor,
  Sun,
  Aperture,
  PaintBucket,
  MagnifyingGlassPlus,
  Sparkle,
  Stack,
  TextHOne,
  Pulse,
  CircleDashed,
  ArrowDown,
  NavigationArrow,
  ArrowsOut,
  FrameCorners,
  Code,
} from '@phosphor-icons/react'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ThemeEffects, OverlayEffects, HoverEffects, TextEffects, UiEffects } from '@/config/themeConfig'

// ── Icon map ──────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactElement> = {
  FilmStrip:           <FilmStrip size={16} weight="duotone" aria-hidden="true" />,
  Monitor:             <Monitor size={16} weight="duotone" aria-hidden="true" />,
  Sun:                 <Sun size={16} weight="duotone" aria-hidden="true" />,
  Aperture:            <Aperture size={16} weight="duotone" aria-hidden="true" />,
  PaintBucket:         <PaintBucket size={16} weight="duotone" aria-hidden="true" />,
  MagnifyingGlassPlus: <MagnifyingGlassPlus size={16} weight="duotone" aria-hidden="true" />,
  ArrowsOut:           <ArrowsOut size={16} weight="duotone" aria-hidden="true" />,
  Sparkle:             <Sparkle size={16} weight="duotone" aria-hidden="true" />,
  FrameCorners:        <FrameCorners size={16} weight="duotone" aria-hidden="true" />,
  Stack:               <Stack size={16} weight="duotone" aria-hidden="true" />,
  TextHOne:            <TextHOne size={16} weight="duotone" aria-hidden="true" />,
  Pulse:               <Pulse size={16} weight="duotone" aria-hidden="true" />,
  CircleDashed:        <CircleDashed size={16} weight="duotone" aria-hidden="true" />,
  ArrowDown:           <ArrowDown size={16} weight="duotone" aria-hidden="true" />,
  NavigationArrow:     <NavigationArrow size={16} weight="duotone" aria-hidden="true" />,
  Code:                <Code size={16} weight="duotone" aria-hidden="true" />,
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface EffectRowProps {
  icon: string
  label: string
  description: string
  enabled?: boolean
  onToggle?: (v: boolean) => void
  /** Slider value 0-max */
  sliderValue?: number
  sliderMin?: number
  sliderMax?: number
  sliderStep?: number
  sliderLabel?: string
  sliderHint?: string
  onSlider?: (v: number) => void
  sliderDisplayFn?: (v: number) => string
  /** Color picker value */
  colorValue?: string
  colorLabel?: string
  onColor?: (v: string) => void
  children?: React.ReactNode
}

function EffectRow({
  icon,
  label,
  description,
  enabled,
  onToggle,
  sliderValue,
  sliderMin = 0,
  sliderMax = 1,
  sliderStep = 0.01,
  sliderLabel,
  sliderHint,
  onSlider,
  sliderDisplayFn,
  colorValue,
  colorLabel,
  onColor,
  children,
}: EffectRowProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-muted-foreground shrink-0">{ICON_MAP[icon]}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {onToggle !== undefined && (
          <Switch
            checked={enabled ?? false}
            onCheckedChange={onToggle}
            aria-label={`Toggle ${label}`}
            className="shrink-0"
          />
        )}
      </div>
      {onSlider !== undefined && sliderValue !== undefined && (
        <div className={`space-y-1 pl-6 ${onToggle && !enabled ? 'opacity-40 pointer-events-none' : ''}`}>
          {sliderLabel && <Label className="text-xs text-muted-foreground">{sliderLabel}</Label>}
          <div className="flex items-center gap-3">
            <Slider
              min={sliderMin}
              max={sliderMax}
              step={sliderStep}
              value={[sliderValue]}
              onValueChange={([v]) => onSlider(v)}
              aria-label={sliderLabel ?? label}
              className="flex-1"
            />
            <span className="w-14 text-right font-mono text-xs text-muted-foreground tabular-nums">
              {sliderDisplayFn ? sliderDisplayFn(sliderValue) : sliderValue.toFixed(2)}
            </span>
          </div>
          {sliderHint && <p className="text-xs text-muted-foreground">{sliderHint}</p>}
        </div>
      )}
      {onColor !== undefined && colorValue !== undefined && (
        <div className={`flex items-center gap-3 pl-6 ${onToggle && !enabled ? 'opacity-40 pointer-events-none' : ''}`}>
          {colorLabel && <Label className="text-xs text-muted-foreground w-24 shrink-0">{colorLabel}</Label>}
          <input
            type="color"
            value={colorValue}
            onChange={(e) => onColor(e.target.value)}
            className="w-10 h-8 rounded border border-border cursor-pointer bg-transparent"
            aria-label={colorLabel ?? 'Colour'}
          />
          <span className="text-xs font-mono text-muted-foreground">{colorValue}</span>
        </div>
      )}
      {children}
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pt-2">{children}</h3>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface EffectsTabProps {
  noiseOpacity: number
  crtEnabled: boolean
  vignetteIntensity: number
  effects: ThemeEffects
  onNoiseOpacity: (v: number) => void
  onCrtEnabled: (v: boolean) => void
  onVignetteIntensity: (v: number) => void
  onEffects: (updated: ThemeEffects) => void
  disabled?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EffectsTab({
  noiseOpacity,
  crtEnabled,
  vignetteIntensity,
  effects,
  onNoiseOpacity,
  onCrtEnabled,
  onVignetteIntensity,
  onEffects,
  disabled = false,
}: EffectsTabProps) {
  // Helper to update nested effect objects
  function patchOverlay(patch: Partial<OverlayEffects>) {
    onEffects({ ...effects, overlay: { ...effects.overlay, ...patch } })
  }
  function patchHover(patch: Partial<HoverEffects>) {
    onEffects({ ...effects, hover: { ...effects.hover, ...patch } })
  }
  function patchText(patch: Partial<TextEffects>) {
    onEffects({ ...effects, text: { ...effects.text, ...patch } })
  }
  function patchUi(patch: Partial<UiEffects>) {
    onEffects({ ...effects, ui: { ...effects.ui, ...patch } })
  }

  const o = effects.overlay ?? {}
  const h = effects.hover ?? {}
  const t = effects.text ?? {}
  const u = effects.ui ?? {}

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Visual effects applied site-wide. Disabled effects use zero resources — no CSS animations, no event handlers.
      </p>

      {/* ── Overlay effects ────────────────────────────────────────────── */}
      <SectionHeading>Overlay</SectionHeading>

      <EffectRow
        icon="FilmStrip"
        label="Film Grain / Noise"
        description="Animated noise texture overlay. Gives footage a tactile, cinematic feel."
        sliderValue={noiseOpacity}
        sliderMin={0}
        sliderMax={0.15}
        sliderStep={0.005}
        sliderLabel="Intensity"
        sliderHint="0 = off · 0.15 = heavy grain. Default: 0.04"
        onSlider={onNoiseOpacity}
        sliderDisplayFn={(v) => v.toFixed(3)}
      />
      <Separator />

      <EffectRow
        icon="Monitor"
        label="CRT Scanlines"
        description="Animated horizontal scanline overlay — retro CRT monitor effect."
        enabled={crtEnabled}
        onToggle={onCrtEnabled}
      />
      <Separator />

      <EffectRow
        icon="Sun"
        label="Vignette"
        description="Darkened edges that draw focus to the centre of the screen."
        sliderValue={vignetteIntensity}
        sliderMin={0}
        sliderMax={1}
        sliderStep={0.05}
        sliderLabel="Intensity"
        sliderHint="0 = none · 1 = strong. Default: 0.50"
        onSlider={onVignetteIntensity}
      />
      <Separator />

      <EffectRow
        icon="Aperture"
        label="Chromatic Aberration"
        description="RGB channel fringing on edges — cyberpunk / lo-fi camera lens effect."
        enabled={o.chromaticAberration?.enabled ?? false}
        onToggle={(v) => patchOverlay({ chromaticAberration: { ...(o.chromaticAberration ?? { intensity: 2 }), enabled: v } })}
        sliderValue={o.chromaticAberration?.intensity ?? 2}
        sliderMin={0.5}
        sliderMax={6}
        sliderStep={0.5}
        sliderLabel="Offset (px)"
        sliderHint="Pixel offset per colour channel"
        onSlider={(v) => patchOverlay({ chromaticAberration: { enabled: o.chromaticAberration?.enabled ?? true, intensity: v } })}
        sliderDisplayFn={(v) => `${v.toFixed(1)}px`}
      />
      <Separator />

      <EffectRow
        icon="PaintBucket"
        label="Colour Wash"
        description="Subtle tinted colour overlay across the whole page."
        enabled={o.colorWash?.enabled ?? false}
        onToggle={(v) => patchOverlay({ colorWash: { ...(o.colorWash ?? { color: '#493687', opacity: 0.08 }), enabled: v } })}
        colorValue={o.colorWash?.color ?? '#493687'}
        colorLabel="Tint colour"
        onColor={(c) => patchOverlay({ colorWash: { enabled: o.colorWash?.enabled ?? true, opacity: o.colorWash?.opacity ?? 0.08, color: c } })}
        sliderValue={o.colorWash?.opacity ?? 0.08}
        sliderMin={0.01}
        sliderMax={0.3}
        sliderStep={0.01}
        sliderLabel="Opacity"
        onSlider={(v) => patchOverlay({ colorWash: { enabled: o.colorWash?.enabled ?? true, color: o.colorWash?.color ?? '#493687', opacity: v } })}
      />

      {/* ── Image & Card Hover effects ────────────────────────────────── */}
      <SectionHeading>Image &amp; Card Hover</SectionHeading>

      <EffectRow
        icon="MagnifyingGlassPlus"
        label="Image Hover Zoom"
        description="Images and cover art gently scale up when hovered."
        enabled={h.imageHoverZoom?.enabled ?? false}
        onToggle={(v) => patchHover({ imageHoverZoom: { ...(h.imageHoverZoom ?? { scale: 1.05 }), enabled: v } })}
        sliderValue={h.imageHoverZoom?.scale ?? 1.05}
        sliderMin={1.01}
        sliderMax={1.2}
        sliderStep={0.01}
        sliderLabel="Scale"
        sliderHint="1.05 = 5 % zoom"
        onSlider={(v) => patchHover({ imageHoverZoom: { enabled: h.imageHoverZoom?.enabled ?? true, scale: v } })}
        sliderDisplayFn={(v) => `×${v.toFixed(2)}`}
      />
      <Separator />

      <EffectRow
        icon="ArrowsOut"
        label="Image 3D Tilt"
        description="Subtle CSS-perspective tilt when hovering over images."
        enabled={h.imageHoverTilt?.enabled ?? false}
        onToggle={(v) => patchHover({ imageHoverTilt: { enabled: v } })}
      />
      <Separator />

      <EffectRow
        icon="Sparkle"
        label="Image Hover Glow"
        description="Coloured glow appears behind images on hover."
        enabled={h.imageHoverGlow?.enabled ?? false}
        onToggle={(v) => patchHover({ imageHoverGlow: { ...(h.imageHoverGlow ?? { color: '#493687', blur: 24 }), enabled: v } })}
        colorValue={h.imageHoverGlow?.color ?? '#493687'}
        colorLabel="Glow colour"
        onColor={(c) => patchHover({ imageHoverGlow: { enabled: h.imageHoverGlow?.enabled ?? true, blur: h.imageHoverGlow?.blur ?? 24, color: c } })}
        sliderValue={h.imageHoverGlow?.blur ?? 24}
        sliderMin={4}
        sliderMax={60}
        sliderStep={2}
        sliderLabel="Blur (px)"
        onSlider={(v) => patchHover({ imageHoverGlow: { enabled: h.imageHoverGlow?.enabled ?? true, color: h.imageHoverGlow?.color ?? '#493687', blur: v } })}
        sliderDisplayFn={(v) => `${v}px`}
      />
      <Separator />

      <EffectRow
        icon="FrameCorners"
        label="Card Hover Scale"
        description="Cards scale up slightly on hover."
        enabled={h.cardHoverScale?.enabled ?? false}
        onToggle={(v) => patchHover({ cardHoverScale: { ...(h.cardHoverScale ?? { scale: 1.03 }), enabled: v } })}
        sliderValue={h.cardHoverScale?.scale ?? 1.03}
        sliderMin={1.01}
        sliderMax={1.1}
        sliderStep={0.005}
        sliderLabel="Scale"
        onSlider={(v) => patchHover({ cardHoverScale: { enabled: h.cardHoverScale?.enabled ?? true, scale: v } })}
        sliderDisplayFn={(v) => `×${v.toFixed(3)}`}
      />
      <Separator />

      <EffectRow
        icon="Stack"
        label="Card Hover Lift"
        description="Drop-shadow deepens on hover, giving a 3-D lifted feel."
        enabled={h.cardHoverLift?.enabled ?? false}
        onToggle={(v) => patchHover({ cardHoverLift: { ...(h.cardHoverLift ?? { intensity: 24 }), enabled: v } })}
        sliderValue={h.cardHoverLift?.intensity ?? 24}
        sliderMin={4}
        sliderMax={60}
        sliderStep={2}
        sliderLabel="Shadow depth (px)"
        onSlider={(v) => patchHover({ cardHoverLift: { enabled: h.cardHoverLift?.enabled ?? true, intensity: v } })}
        sliderDisplayFn={(v) => `${v}px`}
      />

      {/* ── Text effects ──────────────────────────────────────────────── */}
      <SectionHeading>Text</SectionHeading>

      <EffectRow
        icon="TextHOne"
        label="Heading Glow"
        description="Neon text-shadow on h1/h2 headings."
        enabled={t.headingGlow?.enabled ?? false}
        onToggle={(v) => patchText({ headingGlow: { ...(t.headingGlow ?? { color: '#493687', blur: 16 }), enabled: v } })}
        colorValue={t.headingGlow?.color ?? '#493687'}
        colorLabel="Glow colour"
        onColor={(c) => patchText({ headingGlow: { enabled: t.headingGlow?.enabled ?? true, blur: t.headingGlow?.blur ?? 16, color: c } })}
        sliderValue={t.headingGlow?.blur ?? 16}
        sliderMin={2}
        sliderMax={48}
        sliderStep={2}
        sliderLabel="Blur (px)"
        onSlider={(v) => patchText({ headingGlow: { enabled: t.headingGlow?.enabled ?? true, color: t.headingGlow?.color ?? '#493687', blur: v } })}
        sliderDisplayFn={(v) => `${v}px`}
      />
      <Separator />

      <EffectRow
        icon="Sparkle"
        label="Heading Shimmer"
        description="Animated gradient shimmer sweeps across heading text."
        enabled={t.textShimmer?.enabled ?? false}
        onToggle={(v) => patchText({ textShimmer: { enabled: v } })}
      />

      {/* ── UI effects ────────────────────────────────────────────────── */}
      <SectionHeading>UI</SectionHeading>

      <EffectRow
        icon="Pulse"
        label="Border Pulse"
        description="Subtle pulsing glow animation on interactive element borders."
        enabled={u.borderPulse?.enabled ?? false}
        onToggle={(v) => patchUi({ borderPulse: { ...(u.borderPulse ?? { speed: 2.5 }), enabled: v } })}
        sliderValue={u.borderPulse?.speed ?? 2.5}
        sliderMin={0.5}
        sliderMax={6}
        sliderStep={0.25}
        sliderLabel="Speed (s)"
        sliderHint="Pulse cycle duration"
        onSlider={(v) => patchUi({ borderPulse: { enabled: u.borderPulse?.enabled ?? true, speed: v } })}
        sliderDisplayFn={(v) => `${v.toFixed(2)}s`}
      />
      <Separator />

      <EffectRow
        icon="CircleDashed"
        label="Button Ripple"
        description="CSS ripple on button click — Material-style interaction feedback."
        enabled={u.buttonRipple?.enabled ?? false}
        onToggle={(v) => patchUi({ buttonRipple: { enabled: v } })}
      />
      <Separator />

      <EffectRow
        icon="ArrowDown"
        label="Scroll Reveal"
        description="Page sections fade + slide in as they enter the viewport."
        enabled={u.scrollReveal?.enabled ?? false}
        onToggle={(v) => patchUi({ scrollReveal: { enabled: v } })}
      />
      <Separator />

      <EffectRow
        icon="NavigationArrow"
        label="Page-Exit Blur"
        description="Pages blur out when navigating — smoother than hard cuts."
        enabled={u.scrollReveal?.enabled ?? false}
        onToggle={(v) => patchUi({ scrollReveal: { enabled: v } })}
      />

      {/* ── Custom CSS ────────────────────────────────────────────────── */}
      <SectionHeading>Custom CSS</SectionHeading>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {ICON_MAP['Code']}
          <Label className="text-sm font-medium">Custom CSS</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Raw CSS injected site-wide after all generated rules. Use CSS custom properties
          (e.g. <code className="font-mono text-accent">var(--primary)</code>) for theme-aware styles.
          Supports any valid CSS — selectors, keyframes, media queries.
        </p>
        <Textarea
          value={effects.customCss ?? ''}
          onChange={(e) => onEffects({ ...effects, customCss: e.target.value })}
          placeholder={`/* Example: */\n.hero-title {\n  font-size: 5rem;\n  text-transform: uppercase;\n}`}
          className="font-mono text-xs min-h-[180px] resize-y"
          aria-label="Custom CSS"
          disabled={disabled}
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          ⚠️ Custom CSS is injected as-is. Ensure selectors are specific enough to avoid
          overriding admin UI styles.
        </p>
      </div>
    </div>
  )
}
