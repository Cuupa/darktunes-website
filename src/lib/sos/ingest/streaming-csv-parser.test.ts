import { describe, expect, it } from 'vitest'
import { parseCSVContentStreaming } from './streaming-csv-parser'

const BELIEVE_HEADER = 'Artist,Release,Net Revenue,Currency,Sales Month'

describe('parseCSVContentStreaming skips', () => {
  it('records Bandcamp payout rows as skipped, not errors', async () => {
    const csv = [
      'item name,item type,net amount,currency,date',
      'Transfer,payout,50.00,EUR,01/09/2024',
      'Nightfall,digital,10.00,EUR,01/09/2024',
    ].join('\n')

    const result = await parseCSVContentStreaming(csv, 'bandcamp')
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0]?.net_revenue).toBe(10)
    expect(result.skipped.some((skip) => skip.reason === 'bandcamp-payout')).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('records no-artist zero-revenue rows as skipped', async () => {
    const csv = [
      BELIEVE_HEADER,
      ',Album,0,EUR,2024-03',
      'Neuroklast,Album,12.5,EUR,2024-03',
    ].join('\n')

    const result = await parseCSVContentStreaming(csv, 'believe')
    expect(result.transactions).toHaveLength(1)
    expect(result.skipped.some((skip) => skip.reason === 'no-artist-zero-revenue')).toBe(true)
  })

  it('records empty lines as skipped and keeps too-many-columns as an error', async () => {
    const csv = [
      BELIEVE_HEADER,
      '',
      'Neuroklast,Album,12.5,EUR,2024-03,extra,extra,extra,extra,extra,extra',
    ].join('\n')

    const result = await parseCSVContentStreaming(csv, 'believe')
    expect(result.skipped.some((skip) => skip.reason === 'empty-line')).toBe(true)
    expect(result.errors.some((error) => error.reason.includes('Too many columns'))).toBe(true)
  })

  it('counts empty currency cells as EUR warnings', async () => {
    const csv = [
      BELIEVE_HEADER,
      'Neuroklast,Album,12.5,,2024-03',
    ].join('\n')

    const result = await parseCSVContentStreaming(csv, 'believe')
    expect(result.transactions[0]?.currency).toBe('EUR')
    expect(result.emptyCurrencyRows).toBe(1)
  })

  it('keeps quoted embedded newlines inside one row', async () => {
    const csv = [
      BELIEVE_HEADER,
      '"Neuroklast","Album\nDeluxe",12.5,EUR,2024-03',
    ].join('\n')

    const result = await parseCSVContentStreaming(csv, 'believe')
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0]?.release_title).toContain('Album')
    expect(result.transactions[0]?.release_title).toContain('Deluxe')
    expect(result.transactions[0]?.net_revenue).toBe(12.5)
  })

  it('keeps original Believe cell strings on the transaction', async () => {
    const csv = [
      'Artist,Release,Net Revenue,Currency,Sales Month',
      'Neuroklast,Album,12.5,EUR,2024-03',
    ].join('\n')

    const result = await parseCSVContentStreaming(csv, 'believe')
    const tx = result.transactions[0]
    expect(tx?.source_row_id).toBeTruthy()
    expect(tx?.source_headers).toEqual(['Artist', 'Release', 'Net Revenue', 'Currency', 'Sales Month'])
    expect(tx?.source_values).toEqual(['Neuroklast', 'Album', '12.5', 'EUR', '2024-03'])
  })

  it('reports tokenizing then mapping progress', async () => {
    const csv = [
      'Artist,Release,Net Revenue,Currency,Sales Month',
      'Neuroklast,Album,12.5,EUR,2024-03',
      'Neuroklast,EP,1,EUR,2024-04',
    ].join('\n')
    const phases: string[] = []
    await parseCSVContentStreaming(csv, 'believe', (progress) => {
      phases.push(progress.phase)
    })
    expect(phases[0]).toBe('tokenizing')
    expect(phases.at(-1)).toBe('parsing')
  })

  it('reuses one source_headers array for every row in the file', async () => {
    const csv = [
      'Artist,Release,Net Revenue,Currency,Sales Month',
      'Neuroklast,Album,12.5,EUR,2024-03',
      'Neuroklast,EP,1,EUR,2024-04',
    ].join('\n')

    const result = await parseCSVContentStreaming(csv, 'believe')
    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[0]?.source_headers).toBe(result.transactions[1]?.source_headers)
  })
})

describe('parseCSVContentStreaming strict amounts (#632)', () => {
  it('reports an invalid net_revenue value instead of silently using 0', async () => {
    const csv = [
      BELIEVE_HEADER,
      'Neuroklast,Album,12x,EUR,2024-03',
      'Neuroklast,EP,12.5,EUR,2024-03',
    ].join('\n')

    const result = await parseCSVContentStreaming(csv, 'believe')
    expect(result.transactions).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.reason).toContain('net_revenue')
    expect(result.errors[0]?.reason).toContain('12x')
  })

  it('reports a missing required net_revenue value', async () => {
    const csv = [BELIEVE_HEADER, 'Neuroklast,Album,,EUR,2024-03'].join('\n')

    const result = await parseCSVContentStreaming(csv, 'believe')
    expect(result.transactions).toHaveLength(0)
    expect(result.errors[0]?.reason).toContain('net_revenue')
  })

  it('keeps negative refund quantities instead of taking the absolute value', async () => {
    const csv = [
      'Artist,Release,Net Revenue,Currency,Sales Month,Quantity',
      'Neuroklast,Album,12.5,EUR,2024-03,-2',
    ].join('\n')

    const result = await parseCSVContentStreaming(csv, 'believe')
    expect(result.transactions[0]?.quantity).toBe(-2)
  })

  it('rejects a European decimal comma in an EN source instead of misreading it', async () => {
    const csv = [BELIEVE_HEADER, 'Neuroklast,Album,"15,79",EUR,2024-03'].join('\n')

    const result = await parseCSVContentStreaming(csv, 'believe')
    expect(result.transactions).toHaveLength(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.reason).toContain('15,79')
  })
})
