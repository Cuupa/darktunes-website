/**
 * Tests for ThemeStyleInjector (rendered via app/_components/ThemeStyleInjector.tsx)
 *
 * Because the component lives under app/ (outside vitest's src/ scope),
 * we import the logic directly from the source file using a relative path.
 * The component is a pure server component with no hooks or side effects,
 * so it renders synchronously in a jsdom environment.
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

// Relative import from app/ into src/ test — intentional (see vitest.config.ts note)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — path outside @/ alias, resolved by relative import
import { ThemeStyleInjector, buildGoogleFontSpec, GOOGLE_FONT_URL_MAP } from '../../app/_components/ThemeStyleInjector'
import type { ThemeColors } from '../../app/_components/ThemeStyleInjector'
import type { ThemeConfig } from '@/config/themeConfig'

function renderStyle(colors: ThemeColors) {
  const { container } = render(<ThemeStyleInjector {...colors} />)
  const style = container.querySelector('style')
  return style?.textContent ?? null
}

function renderFull(colors: ThemeColors) {
  const { container } = render(<ThemeStyleInjector {...colors} />)
  return container
}

// ── Helper: minimal config with colors ───────────────────────────────────────
function makeConfig(typography: ThemeConfig['typography']): ThemeColors {
  return {
    themeConfig: {
      colors: { primary: '#aaa', secondary: '#bbb', background: '#000', foreground: '#fff', card: '#111', muted: '#222', accent: '#333', border: '#444' },
      gradients: {},
      typography,
      glass: {},
      animation: {},
    },
  }
}

describe('ThemeStyleInjector', () => {
  it('returns null when all color values are empty strings', () => {
    const { container } = render(
      <ThemeStyleInjector
        themePrimary=""
        themeSecondary=""
        themeBackground=""
        themeForeground=""
        themeCard=""
        themeMuted=""
        themeAccent=""
        themeBorder=""
      />,
    )
    expect(container.querySelector('style')).toBeNull()
  })

  it('returns null when no props are passed', () => {
    const { container } = render(<ThemeStyleInjector />)
    expect(container.querySelector('style')).toBeNull()
  })

  it('emits only the non-empty vars', () => {
    const css = renderStyle({ themePrimary: '#ff0000', themeSecondary: '' })
    expect(css).toContain('--primary: #ff0000')
    expect(css).not.toContain('--secondary')
  })

  it('emits all 8 vars when all are set', () => {
    const css = renderStyle({
      themePrimary:    '#111111',
      themeSecondary:  '#222222',
      themeBackground: '#333333',
      themeForeground: '#444444',
      themeCard:       '#555555',
      themeMuted:      '#666666',
      themeAccent:     '#777777',
      themeBorder:     '#888888',
    })
    expect(css).toContain('--primary: #111111')
    expect(css).toContain('--secondary: #222222')
    expect(css).toContain('--background: #333333')
    expect(css).toContain('--foreground: #444444')
    expect(css).toContain('--card: #555555')
    expect(css).toContain('--muted: #666666')
    expect(css).toContain('--accent: #777777')
    expect(css).toContain('--border: #888888')
  })

  it('wraps declarations in :root {}', () => {
    const css = renderStyle({ themePrimary: '#ff0000' })
    expect(css).toMatch(/^:root\s*\{/)
    expect(css).toMatch(/\}$/)
  })

  it('trims whitespace-only values', () => {
    const css = renderStyle({ themePrimary: '   ' })
    expect(css).toBeNull()
  })

  // ── ThemeConfig path ────────────────────────────────────────────────────

  it('emits colors from themeConfig.colors', () => {
    const config: ThemeConfig = {
      colors: { primary: '#aabbcc', secondary: '#ddeeff', background: '#000', foreground: '#fff', card: '#111', muted: '#222', accent: '#333', border: '#444' },
      gradients: {},
      typography: {},
      glass: {},
      animation: {},
    }
    const css = renderStyle({ themeConfig: config })
    expect(css).toContain('--primary: #aabbcc')
    expect(css).toContain('--secondary: #ddeeff')
  })

  it('emits --font-family-body from themeConfig.typography.fontFamily', () => {
    const css = renderStyle(makeConfig({ fontFamily: 'Inter' }))
    expect(css).toContain("--font-family-body: 'Inter', sans-serif")
  })

  it('emits --heading-size from themeConfig.typography.headingSize', () => {
    const css = renderStyle(makeConfig({ headingSize: '3.5rem' }))
    expect(css).toContain('--heading-size: 3.5rem')
  })

  it('emits glass tokens from themeConfig.glass', () => {
    const config: ThemeConfig = {
      colors: { primary: '#aaa', secondary: '#bbb', background: '#000', foreground: '#fff', card: '#111', muted: '#222', accent: '#333', border: '#444' },
      gradients: {},
      typography: {},
      glass: { blur: '16px', opacity: '0.2' },
      animation: {},
    }
    const css = renderStyle({ themeConfig: config })
    expect(css).toContain('--glass-blur: 16px')
    expect(css).toContain('--glass-opacity: 0.2')
  })

  it('emits --animation-duration from themeConfig.animation', () => {
    const config: ThemeConfig = {
      colors: { primary: '#aaa', secondary: '#bbb', background: '#000', foreground: '#fff', card: '#111', muted: '#222', accent: '#333', border: '#444' },
      gradients: {},
      typography: {},
      glass: {},
      animation: { duration: '0.6s' },
    }
    const css = renderStyle({ themeConfig: config })
    expect(css).toContain('--animation-duration: 0.6s')
  })

  it('injects Google Font link tags when fontFamily is a known Google Font', () => {
    const container = renderFull(makeConfig({ fontFamily: 'Inter' }))
    const links = container.querySelectorAll('link')
    expect(links.length).toBeGreaterThanOrEqual(1)
    const hrefs = Array.from(links).map((l) => l.getAttribute('href') ?? '')
    const googleFontsUrl = 'https://fonts.googleapis.com/css2?family=Inter'
    expect(hrefs.some((h) => h.startsWith(googleFontsUrl))).toBe(true)
  })

  it('does NOT inject Google Font links when fontFamily starts with http (raw CSS URL)', () => {
    const container = renderFull(makeConfig({ fontFamily: 'https://fonts.example.com/custom.css' }))
    const links = container.querySelectorAll('link')
    const hasGoogleFont = Array.from(links).some((l) => {
      const href = l.getAttribute('href') ?? ''
      return href.startsWith('https://fonts.googleapis.com/')
    })
    expect(hasGoogleFont).toBe(false)
  })

  // ── --font-serif wiring ────────────────────────────────────────────────────

  it('emits --font-serif with dedicated serifFamily when set', () => {
    const css = renderStyle(makeConfig({ serifFamily: 'Playfair Display' }))
    expect(css).toContain("--font-serif: 'Playfair Display', serif")
  })

  it('emits --font-serif: var(--font-family-body) when only fontFamily is set', () => {
    const css = renderStyle(makeConfig({ fontFamily: 'Inter' }))
    expect(css).toContain('--font-serif: var(--font-family-body)')
  })

  it('does NOT emit --font-serif when neither fontFamily nor serifFamily is set', () => {
    const css = renderStyle(makeConfig({ headingSize: '3rem' }))
    expect(css).not.toContain('--font-serif')
  })

  it('serifFamily takes precedence over fontFamily for --font-serif', () => {
    const css = renderStyle(makeConfig({ fontFamily: 'Inter', serifFamily: 'Cormorant Garamond' }))
    expect(css).toContain("--font-serif: 'Cormorant Garamond', serif")
    expect(css).not.toContain('var(--font-family-body)')
  })

  // ── New typography tokens ──────────────────────────────────────────────────

  it('emits --heading-scale from themeConfig.typography.headingScale', () => {
    const css = renderStyle(makeConfig({ headingScale: '0.8' }))
    expect(css).toContain('--heading-scale: 0.8')
  })

  it('emits --line-height-heading from themeConfig.typography.lineHeightHeading', () => {
    const css = renderStyle(makeConfig({ lineHeightHeading: '1.15' }))
    expect(css).toContain('--line-height-heading: 1.15')
  })

  it('emits --letter-spacing-heading from themeConfig.typography.letterSpacingHeading', () => {
    const css = renderStyle(makeConfig({ letterSpacingHeading: '-0.02' }))
    expect(css).toContain('--letter-spacing-heading: -0.02')
  })

  it('emits all new typography tokens together', () => {
    const css = renderStyle(makeConfig({
      fontFamily: 'DM Sans',
      headingFamily: 'Syne',
      serifFamily: 'Spectral',
      headingSize: '3.5rem',
      headingScale: '0.75',
      bodySize: '1.125rem',
      bodyWeight: '400',
      headingWeight: '700',
      lineHeight: '1.7',
      lineHeightHeading: '1.1',
      letterSpacing: '0.01',
      letterSpacingHeading: '-0.03',
    }))
    expect(css).toContain("--font-family-body: 'DM Sans', sans-serif")
    expect(css).toContain("--font-family-heading: 'Syne', sans-serif")
    expect(css).toContain("--font-serif: 'Spectral', serif")
    expect(css).toContain('--heading-size: 3.5rem')
    expect(css).toContain('--heading-scale: 0.75')
    expect(css).toContain('--body-size: 1.125rem')
    expect(css).toContain('--body-weight: 400')
    expect(css).toContain('--heading-weight: 700')
    expect(css).toContain('--line-height-body: 1.7')
    expect(css).toContain('--line-height-heading: 1.1')
    expect(css).toContain('--letter-spacing-body: 0.01')
    expect(css).toContain('--letter-spacing-heading: -0.03')
  })
})

// ── buildGoogleFontSpec ──────────────────────────────────────────────────────

describe('buildGoogleFontSpec', () => {
  it('returns null for empty string', () => {
    expect(buildGoogleFontSpec('')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(buildGoogleFontSpec('   ')).toBeNull()
  })

  it('always includes 400 as safety fallback weight', () => {
    const spec = buildGoogleFontSpec('Inter', ['700'])
    expect(spec).toContain('400')
    expect(spec).toContain('700')
  })

  it('deduplicates weights', () => {
    const spec = buildGoogleFontSpec('Inter', ['400', '400', '700'])
    // Should contain wght@400;700 (no duplicates)
    expect(spec).toBe('Inter:wght@400;700')
  })

  it('sorts weights numerically', () => {
    const spec = buildGoogleFontSpec('Inter', ['700', '300'])
    expect(spec).toBe('Inter:wght@300;400;700')
  })

  it('uses GOOGLE_FONT_URL_MAP name for known fonts', () => {
    // DM Sans maps to 'DM+Sans' in the URL map
    const dmSansEntry = GOOGLE_FONT_URL_MAP['DM Sans']
    expect(dmSansEntry).toBeDefined()
    const spec = buildGoogleFontSpec('DM Sans', ['400'])
    expect(spec).toContain('DM+Sans')
  })

  it('auto-encodes unknown font names (spaces → +)', () => {
    const spec = buildGoogleFontSpec('My Custom Font', ['400'])
    expect(spec).toContain('My+Custom+Font')
  })

  it('strips CSS fallback stacks — uses only first font name', () => {
    const spec = buildGoogleFontSpec('Inter, sans-serif', ['400'])
    expect(spec).toContain('Inter')
    expect(spec).not.toContain('sans-serif')
  })

  it('strips surrounding quotes from font names', () => {
    const spec = buildGoogleFontSpec("'Playfair Display'", ['400'])
    expect(spec).toContain('Playfair+Display')
    expect(spec).not.toContain("'")
  })

  it('returns null for http URL (not a Google Font name)', () => {
    expect(buildGoogleFontSpec('https://fonts.example.com/font.css')).toBeNull()
  })

  it('produces a valid family spec fragment for a well-known font', () => {
    const spec = buildGoogleFontSpec('Orbitron', ['400', '700'])
    expect(spec).toBe('Orbitron:wght@400;700')
  })
})


