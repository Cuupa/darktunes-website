/**
 * Supplementary edge-case tests for src/lib/stripEmojis.ts.
 * The primary tests live in stripEmojis.test.ts.
 * These cover the early-exit branches for empty/falsy inputs.
 */
import { describe, expect, it } from 'vitest'
import { containsEmojis, stripEmojis, stripEmojisFromHtml } from './stripEmojis'

describe('containsEmojis – edge cases', () => {
  it('returns false for empty string (early exit)', () => {
    expect(containsEmojis('')).toBe(false)
  })

  it('returns false for German umlauts', () => {
    expect(containsEmojis('über')).toBe(false)
  })

  it('returns true for ZWJ sequence (rainbow flag)', () => {
    expect(containsEmojis('🏳️‍🌈')).toBe(true)
  })
})

describe('stripEmojis – edge cases', () => {
  it('returns empty string for empty input (early exit)', () => {
    expect(stripEmojis('')).toBe('')
  })

  it('strips flag emoji entirely', () => {
    expect(stripEmojis('🇩🇪')).toBe('')
  })

  it('strips only emojis, preserves surrounding text', () => {
    expect(stripEmojis('über 🎵 Ärger')).toBe('über  Ärger')
  })
})

describe('stripEmojisFromHtml – edge cases', () => {
  it('returns empty string for empty input (early exit)', () => {
    expect(stripEmojisFromHtml('')).toBe('')
  })

  it('strips emoji from paragraph while preserving tag', () => {
    expect(stripEmojisFromHtml('<p>Hello 👋</p>')).toBe('<p>Hello </p>')
  })

  it('handles multiple sibling elements', () => {
    expect(stripEmojisFromHtml('<strong>🎵</strong><em>text</em>')).toBe(
      '<strong></strong><em>text</em>',
    )
  })
})
