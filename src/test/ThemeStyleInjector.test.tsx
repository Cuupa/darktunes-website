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

function renderStyle(colors: ThemeColors) {
  const { container } = render(<ThemeStyleInjector {...colors} />)
  const style = container.querySelector('style')
  return style?.textContent ?? null
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
})
