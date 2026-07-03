import { describe, expect, it } from 'vitest'
import { getSanitizedPlainTextPaste } from './TiptapEditor'

describe('getSanitizedPlainTextPaste', () => {
  it('returns null for HTML paste so Tiptap can preserve rich formatting', () => {
    expect(getSanitizedPlainTextPaste('Hello 🎵', '<p>Hello 🎵 <strong>world</strong></p>')).toBeNull()
  })

  it('returns null for plain text without emojis', () => {
    expect(getSanitizedPlainTextPaste('Hello world', '')).toBeNull()
  })

  it('strips emojis for plain-text paste', () => {
    expect(getSanitizedPlainTextPaste('Hello 🎵 world 🔥', '')).toBe('Hello  world ')
  })
})
