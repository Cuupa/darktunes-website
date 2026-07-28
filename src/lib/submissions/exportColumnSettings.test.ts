import { describe, it, expect } from 'vitest'
import {
  parseExportColumnsJson,
  serializeExportColumns,
} from './exportColumnSettings'
import { resolveExportColumns, DEFAULT_EXPORT_COLUMNS } from './submissionExport'

describe('exportColumnSettings', () => {
  it('parses { columns: string[] } JSON', () => {
    expect(parseExportColumnsJson(JSON.stringify({ columns: ['artistName', 'releaseTitle'] }))).toEqual([
      'artistName',
      'releaseTitle',
    ])
  })

  it('parses bare string array JSON', () => {
    expect(parseExportColumnsJson(JSON.stringify(['a', 'b']))).toEqual(['a', 'b'])
  })

  it('returns null for invalid JSON', () => {
    expect(parseExportColumnsJson('not-json')).toBeNull()
    expect(parseExportColumnsJson('')).toBeNull()
    expect(parseExportColumnsJson(null)).toBeNull()
  })

  it('serializes columns object', () => {
    expect(JSON.parse(serializeExportColumns(['x', 'y']))).toEqual({ columns: ['x', 'y'] })
  })
})

describe('resolveExportColumns', () => {
  it('uses defaults when saved is empty', () => {
    const result = resolveExportColumns(null, DEFAULT_EXPORT_COLUMNS)
    expect(result[0]).toBe('artistName')
    expect(result).toContain('Composer')
  })

  it('keeps saved order, drops unknown keys, does not re-append unchecked', () => {
    const available = ['artistName', 'releaseTitle', 'Composer', 'Author']
    const result = resolveExportColumns(
      ['Composer', 'missing', 'artistName', 'releaseTitle'],
      available,
    )
    expect(result).toEqual(['Composer', 'artistName', 'releaseTitle'])
  })
})
