'use client'

/**
 * src/components/admin/theme-tabs/TypographyTab.tsx
 *
 * Comprehensive typography settings tab for the Color Theme Manager.
 *
 * Controls:
 *  - Body font family      (50+ Google Fonts + custom name or URL)
 *  - Heading font family   (can differ from body, e.g. Orbitron headings + DM Sans body)
 *  - Serif / Accent font   (overrides --font-serif Tailwind utility)
 *  - Heading scale ratio   (h2 = h1 × scale; h3 = h1 × scale²)
 *  - Heading base size     (h1)
 *  - Body font size
 *  - Body font weight
 *  - Heading font weight
 *  - Body line height
 *  - Heading line height
 *  - Body letter spacing
 *  - Heading letter spacing
 *  - Live preview panel    (self-contained — loads Google Fonts independently)
 */

import React, { useEffect, useState } from 'react'
import { TextAa } from '@phosphor-icons/react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ThemeTypography } from '@/config/themeConfig'
import { buildGoogleFontSpec } from '../../../../app/_components/ThemeStyleInjector'

// ── Font lists ────────────────────────────────────────────────────────────────

export const FONT_OPTIONS: Array<{ value: string; label: string; category: string }> = [
  { value: '',                   label: 'Default (Oxanium)',     category: 'Default' },
  // Sans-serif
  { value: 'Inter',              label: 'Inter',                 category: 'Sans-serif' },
  { value: 'DM Sans',            label: 'DM Sans',               category: 'Sans-serif' },
  { value: 'Outfit',             label: 'Outfit',                category: 'Sans-serif' },
  { value: 'Manrope',            label: 'Manrope',               category: 'Sans-serif' },
  { value: 'Roboto',             label: 'Roboto',                category: 'Sans-serif' },
  { value: 'Open Sans',          label: 'Open Sans',             category: 'Sans-serif' },
  { value: 'Lato',               label: 'Lato',                  category: 'Sans-serif' },
  { value: 'Montserrat',         label: 'Montserrat',            category: 'Sans-serif' },
  { value: 'Poppins',            label: 'Poppins',               category: 'Sans-serif' },
  { value: 'Nunito',             label: 'Nunito',                category: 'Sans-serif' },
  { value: 'Mulish',             label: 'Mulish',                category: 'Sans-serif' },
  { value: 'Quicksand',          label: 'Quicksand',             category: 'Sans-serif' },
  { value: 'Ubuntu',             label: 'Ubuntu',                category: 'Sans-serif' },
  { value: 'Source Sans 3',      label: 'Source Sans 3',         category: 'Sans-serif' },
  { value: 'PT Sans',            label: 'PT Sans',               category: 'Sans-serif' },
  { value: 'IBM Plex Sans',      label: 'IBM Plex Sans',         category: 'Sans-serif' },
  // Geometric / Display
  { value: 'Raleway',            label: 'Raleway',               category: 'Display' },
  { value: 'Josefin Sans',       label: 'Josefin Sans',          category: 'Display' },
  { value: 'Comfortaa',          label: 'Comfortaa',             category: 'Display' },
  { value: 'Barlow',             label: 'Barlow',                category: 'Display' },
  { value: 'Barlow Condensed',   label: 'Barlow Condensed',      category: 'Display' },
  { value: 'Exo 2',              label: 'Exo 2',                 category: 'Display' },
  { value: 'Syne',               label: 'Syne',                  category: 'Display' },
  { value: 'Space Grotesk',      label: 'Space Grotesk',         category: 'Display' },
  { value: 'Big Shoulders Display', label: 'Big Shoulders',      category: 'Display' },
  // Condensed / Bold
  { value: 'Oswald',             label: 'Oswald',                category: 'Condensed' },
  { value: 'Bebas Neue',         label: 'Bebas Neue',            category: 'Condensed' },
  { value: 'Anton',              label: 'Anton',                 category: 'Condensed' },
  { value: 'Alfa Slab One',      label: 'Alfa Slab One',         category: 'Condensed' },
  // Sci-fi / Tech
  { value: 'Orbitron',           label: 'Orbitron',              category: 'Sci-fi' },
  { value: 'Share Tech Mono',    label: 'Share Tech Mono',       category: 'Sci-fi' },
  { value: 'Share Tech',         label: 'Share Tech',            category: 'Sci-fi' },
  { value: 'Exo',                label: 'Exo',                   category: 'Sci-fi' },
  { value: 'Space Mono',         label: 'Space Mono',            category: 'Sci-fi' },
  // Serif
  { value: 'Playfair Display',   label: 'Playfair Display',      category: 'Serif' },
  { value: 'Merriweather',       label: 'Merriweather',          category: 'Serif' },
  { value: 'Libre Baskerville',  label: 'Libre Baskerville',     category: 'Serif' },
  { value: 'Cinzel',             label: 'Cinzel',                category: 'Serif' },
  { value: 'DM Serif Display',   label: 'DM Serif Display',      category: 'Serif' },
  { value: 'Spectral',           label: 'Spectral',              category: 'Serif' },
  { value: 'Cormorant Garamond', label: 'Cormorant Garamond',    category: 'Serif' },
  // Monospace
  { value: 'Fira Code',          label: 'Fira Code',             category: 'Monospace' },
  { value: 'JetBrains Mono',     label: 'JetBrains Mono',        category: 'Monospace' },
  { value: 'Source Code Pro',    label: 'Source Code Pro',       category: 'Monospace' },
  { value: 'Inconsolata',        label: 'Inconsolata',           category: 'Monospace' },
  { value: 'IBM Plex Mono',      label: 'IBM Plex Mono',         category: 'Monospace' },
  // Custom
  { value: 'custom',             label: 'Custom…',               category: 'Custom' },
]

const FONT_WEIGHTS = [
  { value: '300', label: '300 — Light' },
  { value: '400', label: '400 — Regular' },
  { value: '500', label: '500 — Medium' },
  { value: '600', label: '600 — SemiBold' },
  { value: '700', label: '700 — Bold' },
  { value: '800', label: '800 — ExtraBold' },
  { value: '900', label: '900 — Black' },
]

// ── Helper ────────────────────────────────────────────────────────────────────

function isCustomFont(val: string): boolean {
  return !!val && !FONT_OPTIONS.some((o) => o.value === val) && val !== 'custom'
}

// ── Google Font loader (self-contained) ───────────────────────────────────────
// TypographyTab owns its own font-loading side-effect so it works standalone
// in any context (Storybook, test-bed, future refactors) without depending
// on a parent's useEffect.

function loadGoogleFonts(fonts: Array<{ name: string; weights: string[] }>) {
  const specs = fonts
    .map(({ name, weights }) => buildGoogleFontSpec(name, weights))
    .filter((s): s is string => s !== null)
  if (specs.length === 0) return

  const href = `https://fonts.googleapis.com/css2?family=${specs.join('&family=')}&display=swap`
  const existing = document.head.querySelector<HTMLLinkElement>('link[data-ctm-font]')
  if (existing?.href === href) return // already loaded
  existing?.remove()

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.setAttribute('data-ctm-font', 'true')
  document.head.appendChild(link)
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TypographyTabProps {
  typography: ThemeTypography
  onChange: (updated: ThemeTypography) => void
  disabled?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TypographyTab({ typography, onChange, disabled = false }: TypographyTabProps) {
  const {
    fontFamily = '',
    headingFamily = '',
    serifFamily = '',
    headingSize = '3',
    headingScale = '0.8',
    bodySize = '1',
    bodyWeight = '400',
    headingWeight = '700',
    lineHeight = '1.6',
    lineHeightHeading = '1.2',
    letterSpacing = '0',
    letterSpacingHeading = '0',
  } = typography

  // Determine if current values are custom (not in predefined list)
  const bodyIsCustom    = isCustomFont(fontFamily)
  const headingIsCustom = isCustomFont(headingFamily)
  const serifIsCustom   = isCustomFont(serifFamily)

  const [bodySelectVal,    setBodySelectVal]    = useState(() => bodyIsCustom    ? 'custom' : (fontFamily    || '__default__'))
  const [headingSelectVal, setHeadingSelectVal] = useState(() => headingIsCustom ? 'custom' : (headingFamily || '__inherit__'))
  const [serifSelectVal,   setSerifSelectVal]   = useState(() => serifIsCustom   ? 'custom' : (serifFamily   || '__body__'))
  const [customBodyFont,    setCustomBodyFont]    = useState(() => bodyIsCustom    ? fontFamily    : '')
  const [customHeadingFont, setCustomHeadingFont] = useState(() => headingIsCustom ? headingFamily : '')
  const [customSerifFont,   setCustomSerifFont]   = useState(() => serifIsCustom   ? serifFamily   : '')

  const headingSizeNum      = parseFloat(headingSize)       || 3
  const headingScaleNum     = parseFloat(headingScale)      || 0.8
  const bodySizeNum         = parseFloat(bodySize)          || 1
  const lineHeightNum       = parseFloat(lineHeight)        || 1.6
  const lineHeightHeadNum   = parseFloat(lineHeightHeading) || 1.2
  const letterSpNum         = parseFloat(letterSpacing)        || 0
  const letterSpHeadNum     = parseFloat(letterSpacingHeading) || 0

  function patch(partial: Partial<ThemeTypography>) {
    onChange({ ...typography, ...partial })
  }

  function handleBodyFontSelect(val: string) {
    setBodySelectVal(val)
    if (val === '__default__') {
      setCustomBodyFont('')
      patch({ fontFamily: '' })
    } else if (val !== 'custom') {
      setCustomBodyFont('')
      patch({ fontFamily: val })
    }
  }

  function handleHeadingFontSelect(val: string) {
    setHeadingSelectVal(val)
    if (val === '__inherit__') {
      setCustomHeadingFont('')
      patch({ headingFamily: '' })
    } else if (val !== 'custom') {
      setCustomHeadingFont('')
      patch({ headingFamily: val })
    }
  }

  function handleSerifFontSelect(val: string) {
    setSerifSelectVal(val)
    if (val === '__body__') {
      setCustomSerifFont('')
      patch({ serifFamily: '' })
    } else if (val !== 'custom') {
      setCustomSerifFont('')
      patch({ serifFamily: val })
    }
  }

  // ── Self-contained Google Fonts loader ────────────────────────────────────
  // Loads fonts whenever the selected families change. This keeps TypographyTab
  // self-contained — it works in isolation without a parent useEffect.
  const effectiveBodyFont    = bodySelectVal    === 'custom' ? customBodyFont    : bodySelectVal
  const effectiveHeadingFont = headingSelectVal === 'custom' ? customHeadingFont : headingSelectVal
  const effectiveSerifFont   = serifSelectVal   === 'custom' ? customSerifFont   : serifSelectVal

  useEffect(() => {
    const fonts: Array<{ name: string; weights: string[] }> = []
    if (effectiveBodyFont    && effectiveBodyFont    !== '__default__') fonts.push({ name: effectiveBodyFont,    weights: [bodyWeight, '400'] })
    if (effectiveHeadingFont && effectiveHeadingFont !== '__inherit__') fonts.push({ name: effectiveHeadingFont, weights: [headingWeight, '700'] })
    if (effectiveSerifFont   && effectiveSerifFont   !== '__body__')    fonts.push({ name: effectiveSerifFont,   weights: [bodyWeight, '400'] })
    if (fonts.length > 0) loadGoogleFonts(fonts)
  }, [effectiveBodyFont, effectiveHeadingFont, effectiveSerifFont, bodyWeight, headingWeight])

  // ── Preview styles ────────────────────────────────────────────────────────
  const bodyFF = effectiveBodyFont && effectiveBodyFont !== '__default__'
    ? `'${effectiveBodyFont}', sans-serif`
    : 'inherit'
  const headFF = (effectiveHeadingFont && effectiveHeadingFont !== '__inherit__')
    ? `'${effectiveHeadingFont}', sans-serif`
    : bodyFF

  const previewStyle: React.CSSProperties = {
    fontFamily:    bodyFF,
    fontSize:      `${bodySizeNum}rem`,
    fontWeight:    bodyWeight as React.CSSProperties['fontWeight'],
    lineHeight:    lineHeightNum,
    letterSpacing: `${letterSpNum}em`,
  }

  const previewHeadingStyle: React.CSSProperties = {
    fontFamily:    headFF,
    fontSize:      `${headingSizeNum}rem`,
    fontWeight:    headingWeight as React.CSSProperties['fontWeight'],
    lineHeight:    lineHeightHeadNum,
    letterSpacing: `${letterSpHeadNum}em`,
  }

  const previewH2Style: React.CSSProperties = {
    ...previewHeadingStyle,
    fontSize: `${headingSizeNum * headingScaleNum}rem`,
  }

  const previewH3Style: React.CSSProperties = {
    ...previewHeadingStyle,
    fontSize: `${headingSizeNum * headingScaleNum * headingScaleNum}rem`,
  }

  const categorised = FONT_OPTIONS.reduce<Record<string, typeof FONT_OPTIONS>>((acc, opt) => {
    if (!acc[opt.category]) acc[opt.category] = []
    acc[opt.category].push(opt)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Override site typography. Font families are loaded from Google Fonts as you change the selection.
        CSS tokens: <code className="font-mono text-accent text-xs">--font-family-body</code>,{' '}
        <code className="font-mono text-accent text-xs">--font-family-heading</code>,{' '}
        <code className="font-mono text-accent text-xs">--font-serif</code>.
      </p>

      {/* ── Body Font ────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <TextAa size={16} weight="duotone" aria-hidden="true" className="text-muted-foreground" />
          <Label className="text-sm font-medium">Body Font Family</Label>
        </div>
        <Select value={bodySelectVal} onValueChange={handleBodyFontSelect} disabled={disabled}>
          <SelectTrigger aria-label="Body font family">
            <SelectValue placeholder="Select body font…" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {Object.entries(categorised).map(([cat, opts]) => (
              <React.Fragment key={cat}>
                <div className="px-2 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{cat}</div>
                {opts.map((o) => (
                  <SelectItem key={o.value || '__default__'} value={o.value || '__default__'}>{o.label}</SelectItem>
                ))}
              </React.Fragment>
            ))}
          </SelectContent>
        </Select>
        {bodySelectVal === 'custom' && (
          <Input
            placeholder="Google Font name (e.g. Exo 2) or https://fonts.googleapis.com/… URL"
            value={customBodyFont}
            onChange={(e) => {
              setCustomBodyFont(e.target.value)
              patch({ fontFamily: e.target.value })
            }}
            className="font-mono text-sm"
            disabled={disabled}
            aria-label="Custom body font name or URL"
          />
        )}
        <p className="text-xs text-muted-foreground">CSS token: <code className="font-mono">--font-family-body</code></p>
      </div>
      <Separator />

      {/* ── Heading Font ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <TextAa size={16} weight="duotone" aria-hidden="true" className="text-muted-foreground" />
          <Label className="text-sm font-medium">Heading Font Family</Label>
        </div>
        <Select value={headingSelectVal} onValueChange={handleHeadingFontSelect} disabled={disabled}>
          <SelectTrigger aria-label="Heading font family">
            <SelectValue placeholder="Same as body…" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="__inherit__">Same as body font</SelectItem>
            {Object.entries(categorised).filter(([cat]) => cat !== 'Default').map(([cat, opts]) => (
              <React.Fragment key={cat}>
                <div className="px-2 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{cat}</div>
                {opts.filter((o) => o.value !== '').map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </React.Fragment>
            ))}
          </SelectContent>
        </Select>
        {headingSelectVal === 'custom' && (
          <Input
            placeholder="Google Font name (e.g. Orbitron) or full URL"
            value={customHeadingFont}
            onChange={(e) => {
              setCustomHeadingFont(e.target.value)
              patch({ headingFamily: e.target.value })
            }}
            className="font-mono text-sm"
            disabled={disabled}
            aria-label="Custom heading font name or URL"
          />
        )}
        <p className="text-xs text-muted-foreground">CSS token: <code className="font-mono">--font-family-heading</code>. Falls back to body font.</p>
      </div>
      <Separator />

      {/* ── Serif / Accent Font ──────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <TextAa size={16} weight="duotone" aria-hidden="true" className="text-muted-foreground" />
          <Label className="text-sm font-medium">Serif / Accent Font</Label>
        </div>
        <Select value={serifSelectVal} onValueChange={handleSerifFontSelect} disabled={disabled}>
          <SelectTrigger aria-label="Serif / accent font family">
            <SelectValue placeholder="Follows body font…" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="__body__">Follows body font (default)</SelectItem>
            {Object.entries(categorised).filter(([cat]) => cat !== 'Default').map(([cat, opts]) => (
              <React.Fragment key={cat}>
                <div className="px-2 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{cat}</div>
                {opts.filter((o) => o.value !== '').map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </React.Fragment>
            ))}
          </SelectContent>
        </Select>
        {serifSelectVal === 'custom' && (
          <Input
            placeholder="Google Font name (e.g. Playfair Display) or full URL"
            value={customSerifFont}
            onChange={(e) => {
              setCustomSerifFont(e.target.value)
              patch({ serifFamily: e.target.value })
            }}
            className="font-mono text-sm"
            disabled={disabled}
            aria-label="Custom serif / accent font name or URL"
          />
        )}
        <p className="text-xs text-muted-foreground">
          CSS token: <code className="font-mono">--font-serif</code>. Used by Hero subheadings, artist bios,
          MarkdownContent, section subtitles. When unset, inherits the body font.
        </p>
      </div>
      <Separator />

      {/* ── Heading Scale Ratio ──────────────────────────────────────── */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Heading Scale Ratio</Label>
        <div className="flex items-center gap-3">
          <Slider
            min={0.5}
            max={1.0}
            step={0.01}
            value={[headingScaleNum]}
            onValueChange={([v]) => patch({ headingScale: `${v.toFixed(2)}` })}
            aria-label="Heading scale ratio"
            className="flex-1"
            disabled={disabled}
          />
          <span className="w-14 text-right font-mono text-sm text-muted-foreground tabular-nums">{headingScaleNum.toFixed(2)}×</span>
        </div>
        <p className="text-xs text-muted-foreground">
          CSS token: <code className="font-mono">--heading-scale</code>.
          h2 = h1 × scale ({(headingSizeNum * headingScaleNum).toFixed(2)}rem);
          h3 = h1 × scale² ({(headingSizeNum * headingScaleNum * headingScaleNum).toFixed(2)}rem).
        </p>
      </div>
      <Separator />

      {/* ── Heading Size ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Base Heading Size (h1)</Label>
        <div className="flex items-center gap-3">
          <Slider
            min={1.5}
            max={6}
            step={0.125}
            value={[headingSizeNum]}
            onValueChange={([v]) => patch({ headingSize: `${v}rem` })}
            aria-label="Base heading size"
            className="flex-1"
            disabled={disabled}
          />
          <span className="w-14 text-right font-mono text-sm text-muted-foreground tabular-nums">{headingSizeNum.toFixed(3)}rem</span>
        </div>
        <p className="text-xs text-muted-foreground">CSS token: <code className="font-mono">--heading-size</code>. h2/h3 derived via scale ratio above.</p>
      </div>
      <Separator />

      {/* ── Body Size ────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Body Font Size</Label>
        <div className="flex items-center gap-3">
          <Slider
            min={0.75}
            max={1.5}
            step={0.025}
            value={[bodySizeNum]}
            onValueChange={([v]) => patch({ bodySize: `${v}rem` })}
            aria-label="Body font size"
            className="flex-1"
            disabled={disabled}
          />
          <span className="w-14 text-right font-mono text-sm text-muted-foreground tabular-nums">{bodySizeNum.toFixed(3)}rem</span>
        </div>
        <p className="text-xs text-muted-foreground">CSS token: <code className="font-mono">--body-size</code>.</p>
      </div>
      <Separator />

      {/* ── Font Weights ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Body Font Weight</Label>
          <Select value={bodyWeight} onValueChange={(v) => patch({ bodyWeight: v })} disabled={disabled}>
            <SelectTrigger aria-label="Body font weight">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_WEIGHTS.map((w) => (
                <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">CSS: <code className="font-mono">--body-weight</code></p>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Heading Font Weight</Label>
          <Select value={headingWeight} onValueChange={(v) => patch({ headingWeight: v })} disabled={disabled}>
            <SelectTrigger aria-label="Heading font weight">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_WEIGHTS.map((w) => (
                <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">CSS: <code className="font-mono">--heading-weight</code></p>
        </div>
      </div>
      <Separator />

      {/* ── Line Heights ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Line Height (body)</Label>
          <div className="flex items-center gap-3">
            <Slider
              min={1}
              max={2.5}
              step={0.05}
              value={[lineHeightNum]}
              onValueChange={([v]) => patch({ lineHeight: `${v}` })}
              aria-label="Body line height"
              className="flex-1"
              disabled={disabled}
            />
            <span className="w-12 text-right font-mono text-sm text-muted-foreground tabular-nums">{lineHeightNum.toFixed(2)}</span>
          </div>
          <p className="text-xs text-muted-foreground">CSS: <code className="font-mono">--line-height-body</code></p>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Line Height (headings)</Label>
          <div className="flex items-center gap-3">
            <Slider
              min={0.9}
              max={2}
              step={0.05}
              value={[lineHeightHeadNum]}
              onValueChange={([v]) => patch({ lineHeightHeading: `${v}` })}
              aria-label="Heading line height"
              className="flex-1"
              disabled={disabled}
            />
            <span className="w-12 text-right font-mono text-sm text-muted-foreground tabular-nums">{lineHeightHeadNum.toFixed(2)}</span>
          </div>
          <p className="text-xs text-muted-foreground">CSS: <code className="font-mono">--line-height-heading</code></p>
        </div>
      </div>
      <Separator />

      {/* ── Letter Spacing ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Letter Spacing (body)</Label>
          <div className="flex items-center gap-3">
            <Slider
              min={-0.05}
              max={0.2}
              step={0.005}
              value={[letterSpNum]}
              onValueChange={([v]) => patch({ letterSpacing: `${v.toFixed(3)}` })}
              aria-label="Body letter spacing"
              className="flex-1"
              disabled={disabled}
            />
            <span className="w-16 text-right font-mono text-sm text-muted-foreground tabular-nums">{letterSpNum.toFixed(3)}em</span>
          </div>
          <p className="text-xs text-muted-foreground">CSS: <code className="font-mono">--letter-spacing-body</code></p>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Letter Spacing (headings)</Label>
          <div className="flex items-center gap-3">
            <Slider
              min={-0.1}
              max={0.3}
              step={0.005}
              value={[letterSpHeadNum]}
              onValueChange={([v]) => patch({ letterSpacingHeading: `${v.toFixed(3)}` })}
              aria-label="Heading letter spacing"
              className="flex-1"
              disabled={disabled}
            />
            <span className="w-16 text-right font-mono text-sm text-muted-foreground tabular-nums">{letterSpHeadNum.toFixed(3)}em</span>
          </div>
          <p className="text-xs text-muted-foreground">CSS: <code className="font-mono">--letter-spacing-heading</code></p>
        </div>
      </div>
      <Separator />

      {/* ── Live Preview ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Live Preview</Label>
        <div className="rounded-lg border border-border bg-card p-5 space-y-3 overflow-hidden">
          <p style={previewHeadingStyle} className="text-foreground">
            Heading h1 — The Quick Brown Fox
          </p>
          <p style={previewH2Style} className="text-foreground">
            Heading h2 — Jumps Over the Lazy Dog
          </p>
          <p style={previewH3Style} className="text-foreground/80">
            Heading h3 — AaBbCcDdEeFfGg 0123456789
          </p>
          <p style={previewStyle} className="text-foreground/80">
            AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz 0123456789
          </p>
          <p style={previewStyle} className="text-muted-foreground">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum
            dignissim commodo orci in porttitor. Sed vehicula enim non felis
            ornare suscipit.
          </p>
        </div>
      </div>
    </div>
  )
}
