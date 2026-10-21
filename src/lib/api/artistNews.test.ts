import { describe, expect, it } from 'vitest'
import { excerptFromContent, uniqueArtistNewsSlug } from './artistNews'

describe('uniqueArtistNewsSlug', () => {
  it('uses the title slug when free', () => {
    expect(uniqueArtistNewsSlug('Hello World', [])).toBe('hello-world')
  })

  it('appends a counter when taken', () => {
    expect(uniqueArtistNewsSlug('Hello', ['hello'])).toBe('hello-2')
    expect(uniqueArtistNewsSlug('Hello', ['hello', 'hello-2'])).toBe('hello-3')
  })
})

describe('excerptFromContent', () => {
  it('strips tags and truncates', () => {
    const html = `<p>${'word '.repeat(80)}</p>`
    const excerpt = excerptFromContent(html)
    expect(excerpt.includes('<')).toBe(false)
    expect(excerpt.endsWith('…')).toBe(true)
    expect(excerpt.length).toBeLessThanOrEqual(160)
  })
})
