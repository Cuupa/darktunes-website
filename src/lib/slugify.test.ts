import { describe, it, expect } from 'vitest'
import { toSlug } from './slugify'

describe('toSlug', () => {
  it('lowercases ASCII letters', () => {
    expect(toSlug('Hello World')).toBe('hello-world')
  })

  it('expands German umlauts', () => {
    expect(toSlug('über Ärger Öko üble ärger öko')).toBe('ueber-aerger-oeko-ueble-aerger-oeko')
  })

  it('expands ß to ss', () => {
    expect(toSlug('Straße')).toBe('strasse')
  })

  it('strips accented characters via NFKD', () => {
    expect(toSlug('Café René')).toBe('cafe-rene')
  })

  it('replaces runs of non-alphanumeric chars with a single hyphen', () => {
    expect(toSlug('foo  &  bar!!')).toBe('foo-bar')
  })

  it('trims leading and trailing hyphens', () => {
    expect(toSlug('---hello---')).toBe('hello')
  })

  it('handles an empty string', () => {
    expect(toSlug('')).toBe('')
  })

  it('handles a real-world artist name with umlaut', () => {
    // 'Einstürzende' → ü→ue = 'Einstuerzende'
    expect(toSlug('Einstürzende Neubauten')).toBe('einstuerzende-neubauten')
  })

  it('output contains only lowercase alphanumeric and hyphens', () => {
    const result = toSlug('Die Ärzte & Die Toten Hosen!!!')
    expect(result).toMatch(/^[a-z0-9-]+$/)
  })
})
