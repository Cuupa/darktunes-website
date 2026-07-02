import { describe, expect, it } from 'vitest'
import { resolveFaqLocaleField } from './faqLocale'

describe('resolveFaqLocaleField', () => {
  it('returns English for en locale', () => {
    expect(resolveFaqLocaleField('en', 'Hello', 'Hallo')).toBe('Hello')
  })

  it('returns German when locale is de and translation exists', () => {
    expect(resolveFaqLocaleField('de', 'Hello', 'Hallo')).toBe('Hallo')
  })

  it('falls back to English when German is empty', () => {
    expect(resolveFaqLocaleField('de', 'Hello', '')).toBe('Hello')
    expect(resolveFaqLocaleField('de', 'Hello', null)).toBe('Hello')
    expect(resolveFaqLocaleField('de', 'Hello', '   ')).toBe('Hello')
  })
})