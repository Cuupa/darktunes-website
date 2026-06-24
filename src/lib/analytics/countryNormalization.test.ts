import { describe, it, expect } from 'vitest'
import { normalizeCountryName, countriesMatch } from './countryNormalization'

describe('countryNormalization', () => {
  it('normalises common aliases', () => {
    expect(normalizeCountryName('de')).toBe('Germany')
    expect(normalizeCountryName('UK')).toBe('United Kingdom')
  })

  it('matches equivalent country names', () => {
    expect(countriesMatch('Deutschland', 'Germany')).toBe(true)
    expect(countriesMatch('Germany', 'France')).toBe(false)
  })
})