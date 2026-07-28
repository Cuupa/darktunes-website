import { describe, expect, it } from 'vitest'
import {
  composeLabelAddress,
  parseLabelAddress,
  splitStreetAndNumber,
} from './labelAddress'

describe('labelAddress', () => {
  it('splits street and house number', () => {
    expect(splitStreetAndNumber('Friedhofweg 1')).toEqual({
      street: 'Friedhofweg',
      houseNumber: '1',
    })
    expect(splitStreetAndNumber('Main Street 12a')).toEqual({
      street: 'Main Street',
      houseNumber: '12a',
    })
  })

  it('parses multi-line and comma addresses', () => {
    expect(parseLabelAddress('Friedhofweg 1\n69118 Heidelberg\nGermany')).toEqual({
      street: 'Friedhofweg',
      houseNumber: '1',
      postalCode: '69118',
      city: 'Heidelberg',
      country: 'Germany',
    })
    expect(parseLabelAddress('Friedhofweg 1, 69118 Heidelberg, Germany')).toEqual({
      street: 'Friedhofweg',
      houseNumber: '1',
      postalCode: '69118',
      city: 'Heidelberg',
      country: 'Germany',
    })
  })

  it('round-trips via compose', () => {
    const parts = {
      street: 'Friedhofweg',
      houseNumber: '1',
      postalCode: '69118',
      city: 'Heidelberg',
      country: 'Germany',
    }
    expect(composeLabelAddress(parts)).toBe('Friedhofweg 1\n69118 Heidelberg\nGermany')
    expect(parseLabelAddress(composeLabelAddress(parts))).toEqual(parts)
  })
})
