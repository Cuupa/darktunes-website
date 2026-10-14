import { describe, expect, it } from 'vitest'
import { generateSepaXml } from './sepa-generator'

const iban = 'DE89370400440532013000'

describe('generateSepaXml', () => {
  it('makes the control total equal the rounded lines', () => {
    const xml = generateSepaXml(
      [
        { accountHolder: 'A', iban, amount: 1.005 },
        { accountHolder: 'B', iban, amount: 1.005 },
      ],
      { accountHolder: 'Label', iban, periodLabel: '2026-01' },
    )
    const lines = [...xml.matchAll(/<InstdAmt Ccy="EUR">([^<]+)<\/InstdAmt>/g)].map((match) => match[1])
    const sums = [...xml.matchAll(/<CtrlSum>([^<]+)<\/CtrlSum>/g)].map((match) => match[1])
    const lineSum = lines.reduce((acc, value) => acc + Number(value), 0).toFixed(2)
    expect(lines).toHaveLength(2)
    expect(sums).toEqual([lineSum, lineSum])
  })

  it('cuts the note before escaping it', () => {
    const xml = generateSepaXml(
      [{ accountHolder: 'A', iban, amount: 1 }],
      { accountHolder: 'A&'.repeat(80), iban, periodLabel: 'P' },
    )
    const note = xml.match(/<Ustrd>([^<]*)<\/Ustrd>/)?.[1] ?? ''
    expect(note).toContain('&amp;')
    expect(note).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/)
  })
})
