/**
 * src/lib/epk/themes.test.ts
 *
 * Unit tests for EPK theme registry and token resolution.
 */

import { describe, it, expect } from 'vitest'
import { getEPKTheme, EPK_THEMES, DEFAULT_SECTIONS_ORDER } from './themes'

describe('getEPKTheme', () => {
  it('returns the default theme for "default"', () => {
    const theme = getEPKTheme('default')
    expect(theme.id).toBe('default')
    expect(theme.article).toBeTruthy()
    expect(theme.text).toBeTruthy()
    expect(theme.accent).toBeTruthy()
  })

  it('returns blade-runner theme with correct id', () => {
    const theme = getEPKTheme('blade-runner')
    expect(theme.id).toBe('blade-runner')
    expect(theme.accent).toBe('#F0F0F0')
  })

  it('blade-runner header background is pure black', () => {
    const theme = getEPKTheme('blade-runner')
    expect((theme.header as { background?: string }).background).toBe('#000000')
  })

  it('falls back to default theme for unknown key', () => {
    const theme = getEPKTheme('does-not-exist')
    expect(theme.id).toBe('default')
  })

  it('blade-runner article has no 3D transforms', () => {
    const theme = getEPKTheme('blade-runner')
    const articleStyle = JSON.stringify(theme.article ?? {})
    expect(articleStyle).not.toContain('perspective')
    expect(articleStyle).not.toContain('rotate')
    expect(articleStyle).not.toContain('translateZ')
  })
})

describe('EPK_THEMES', () => {
  it('contains at least two themes', () => {
    expect(Object.keys(EPK_THEMES).length).toBeGreaterThanOrEqual(2)
  })

  it('all themes have required token fields', () => {
    for (const theme of Object.values(EPK_THEMES)) {
      expect(theme.id).toBeTruthy()
      expect(theme.article).toBeTruthy()
      expect(theme.text).toBeTruthy()
      expect(theme.accent).toBeTruthy()
    }
  })
})

describe('DEFAULT_SECTIONS_ORDER', () => {
  it('contains core section IDs', () => {
    expect(DEFAULT_SECTIONS_ORDER).toContain('header')
    expect(DEFAULT_SECTIONS_ORDER).toContain('bio')
    expect(DEFAULT_SECTIONS_ORDER).toContain('contacts')
    expect(DEFAULT_SECTIONS_ORDER).toContain('links')
  })
})
