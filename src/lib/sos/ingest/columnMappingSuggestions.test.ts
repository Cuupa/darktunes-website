import { describe, expect, it } from 'vitest'
import {
  suggestColumnMappings,
  resolveProfileColumnsAgainstHeaders,
} from './columnMappingSuggestions'

describe('columnMappingSuggestions', () => {
  it('suggests mappings for Bandcamp headers', () => {
    const headers = [
      'date',
      'paid to',
      'item type',
      'item name',
      'artist',
      'net amount',
      'country',
      'bandcamp transaction id',
    ]
    const suggestions = suggestColumnMappings(headers)
    expect(suggestions.artistName).toBe('artist')
    expect(suggestions.netRevenue).toBe('net amount')
    expect(suggestions.salesMonth).toBe('date')
    expect(suggestions.country).toBe('country')
  })

  it('suggests mappings for Believe headers', () => {
    const headers = [
      'Believe Sales Month',
      'Platform',
      'Artist Name',
      'Net Revenue',
      'Quantity',
    ]
    const suggestions = suggestColumnMappings(headers)
    expect(suggestions.salesMonth).toBe('Believe Sales Month')
    expect(suggestions.artistName).toBe('Artist Name')
    expect(suggestions.netRevenue).toBe('Net Revenue')
  })

  it('resolves profile columns with partial header match', () => {
    const resolved = resolveProfileColumnsAgainstHeaders(
      { salesMonth: 'Sales Month', artistName: 'Artist Name' },
      ['Believe Sales Month', 'Platform', 'Artist Name', 'Net Revenue'],
    )
    expect(resolved.salesMonth).toBe('Believe Sales Month')
    expect(resolved.artistName).toBe('Artist Name')
  })
})