import { describe, expect, it } from 'vitest'
import { containsEmojis, stripEmojis, stripEmojisFromHtml } from './stripEmojis'

describe('stripEmojis', () => {
  it('removes simple emojis', () => {
    expect(stripEmojis('Hello 🎵 World')).toBe('Hello  World')
  })

  it('removes skin-tone and ZWJ sequences', () => {
    expect(stripEmojis('Family 👨‍👩‍👧 ok')).toBe('Family  ok')
  })

  it('removes flag emojis', () => {
    expect(stripEmojis('Tour 🇩🇪 soon')).toBe('Tour  soon')
  })

  it('preserves umlauts and special characters', () => {
    expect(stripEmojis('Größe & «quotes» — dash')).toBe('Größe & «quotes» — dash')
  })

  it('detects emoji presence', () => {
    expect(containsEmojis('plain')).toBe(false)
    expect(containsEmojis('with 🔥')).toBe(true)
  })
})

describe('stripEmojisFromHtml', () => {
  it('removes emojis from text nodes only', () => {
    const html = '<p>Release 🎉 <strong>out now 🔥</strong></p>'
    expect(stripEmojisFromHtml(html)).toBe('<p>Release  <strong>out now </strong></p>')
  })

  it('preserves allowed attributes', () => {
    const html = '<a href="https://example.com">Link 🚀</a>'
    expect(stripEmojisFromHtml(html)).toBe('<a href="https://example.com">Link </a>')
  })
})