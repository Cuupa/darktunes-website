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
import { ThemeStyleInjector } from '../../app/_components/ThemeStyleInjector'
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
    const config: ThemeConfig = {
      colors: { primary: '#aaa', secondary: '#bbb', background: '#000', foreground: '#fff', card: '#111', muted: '#222', accent: '#333', border: '#444' },
      gradients: {},
      typography: { fontFamily: 'Inter' },
      glass: {},
      animation: {},
    }
    const css = renderStyle({ themeConfig: config })
    expect(css).toContain('--font-family-body: Inter')
  })

  it('emits --heading-size from themeConfig.typography.headingSize', () => {
    const config: ThemeConfig = {
      colors: { primary: '#aaa', secondary: '#bbb', background: '#000', foreground: '#fff', card: '#111', muted: '#222', accent: '#333', border: '#444' },
      gradients: {},
      typography: { headingSize: '3.5rem' },
      glass: {},
      animation: {},
    }
    const css = renderStyle({ themeConfig: config })
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
    const config: ThemeConfig = {
      colors: { primary: '#aaa', secondary: '#bbb', background: '#000', foreground: '#fff', card: '#111', muted: '#222', accent: '#333', border: '#444' },
      gradients: {},
      typography: { fontFamily: 'Inter' },
      glass: {},
      animation: {},
    }
    const container = renderFull({ themeConfig: config })
    const links = container.querySelectorAll('link')
    expect(links.length).toBeGreaterThanOrEqual(1)
    const hrefs = Array.from(links).map((l) => l.getAttribute('href') ?? '')
    const googleFontsUrl = 'https://fonts.googleapis.com/css2?family=Inter'
    expect(hrefs.some((h) => h.startsWith(googleFontsUrl))).toBe(true)
  })

  it('does NOT inject Google Font links for unknown font family', () => {
    const config: ThemeConfig = {
      colors: { primary: '#aaa', secondary: '#bbb', background: '#000', foreground: '#fff', card: '#111', muted: '#222', accent: '#333', border: '#444' },
      gradients: {},
      typography: { fontFamily: "'My Custom Font', sans-serif" },
      glass: {},
      animation: {},
    }
    const container = renderFull({ themeConfig: config })
    const links = container.querySelectorAll('link')
    const hasGoogleFont = Array.from(links).some((l) => {
      const href = l.getAttribute('href') ?? ''
      return href.startsWith('https://fonts.googleapis.com/')
    })
    expect(hasGoogleFont).toBe(false)
  })
})

