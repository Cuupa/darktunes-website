/**
 * src/config/themePresets.test.ts
 *
 * Validates that all 20 ThemeConfig presets are complete and well-formed.
 */

import { describe, it, expect } from 'vitest'
import { THEME_PRESETS, THEME_PRESET_LABELS } from '@/config/themePresets'
import type { ThemeConfig } from '@/config/themeConfig'

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function isHex(v: string): boolean {
  return HEX_RE.test(v)
}

function isValidColors(c: ThemeConfig['colors']): boolean {
  return (
    isHex(c.primary) &&
    isHex(c.secondary) &&
    isHex(c.background) &&
    isHex(c.foreground) &&
    isHex(c.card) &&
    isHex(c.muted) &&
    isHex(c.accent) &&
    isHex(c.border)
  )
}

describe('THEME_PRESETS', () => {
  it('exports exactly 20 presets', () => {
    expect(Object.keys(THEME_PRESETS)).toHaveLength(20)
  })

  it('every preset has a label in THEME_PRESET_LABELS', () => {
    for (const key of Object.keys(THEME_PRESETS)) {
      expect(THEME_PRESET_LABELS[key], `Missing label for preset "${key}"`).toBeDefined()
      expect(THEME_PRESET_LABELS[key].length).toBeGreaterThan(0)
    }
  })

  for (const [key, preset] of Object.entries(THEME_PRESETS)) {
    describe(`preset "${key}"`, () => {
      it('has all required ThemeConfig keys', () => {
        expect(preset).toHaveProperty('colors')
        expect(preset).toHaveProperty('gradients')
        expect(preset).toHaveProperty('typography')
        expect(preset).toHaveProperty('glass')
        expect(preset).toHaveProperty('animation')
      })

      it('colors are valid hex strings', () => {
        expect(isValidColors(preset.colors), `Invalid colors in preset "${key}": ${JSON.stringify(preset.colors)}`).toBe(true)
      })

      it('typography.fontFamily is a non-empty string when set', () => {
        if (preset.typography.fontFamily !== undefined) {
          expect(typeof preset.typography.fontFamily).toBe('string')
          expect(preset.typography.fontFamily.trim().length).toBeGreaterThan(0)
        }
      })

      it('animation.preset is a non-empty string when set', () => {
        if (preset.animation.preset !== undefined) {
          expect(typeof preset.animation.preset).toBe('string')
          expect(preset.animation.preset.trim().length).toBeGreaterThan(0)
        }
      })

      it('animation.duration matches CSS time format when set', () => {
        if (preset.animation.duration !== undefined) {
          expect(preset.animation.duration).toMatch(/^\d+(\.\d+)?s$/)
        }
      })
    })
  }
})
