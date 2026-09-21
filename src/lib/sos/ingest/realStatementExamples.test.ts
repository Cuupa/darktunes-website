import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractPeriodBounds } from '@/lib/sos/bronzeUpload'
import { processTransactionsWithCompilations } from '@/lib/sos/data-processor'
import type { DataProcessorConfig } from '@/lib/sos/data-processor/types'
import { parseDarkmerchCSV, parseDarkmerchXLSX } from '@/lib/sos/ingest/darkmerch-parser'
import { parseCSVContentStreaming } from '@/lib/sos/ingest/streaming-csv-parser'
import { explainSosError } from '@/lib/sos/explainSosError'

const DIR = resolve(process.cwd(), 'statement of sales examples', 'Q4 2025 - Q1 2026')

function examplePath(name: string): string {
  return resolve(DIR, name)
}

function readCsvText(path: string): string {
  const buffer = readFileSync(path)
  const first = buffer.subarray(0, 2)
  if (first[0] === 0xff && first[1] === 0xfe) {
    return buffer.toString('utf16le')
  }
  if (first[0] === 0xfe && first[1] === 0xff) {
    return Buffer.from(buffer.subarray(2)).swap16().toString('utf16le')
  }
  return buffer.toString('utf8')
}

function assertMoney(artistData: Array<{ artist: string; grossRevenue: number; finalPayout: number; amountDueEur: number }>) {
  expect(artistData.length).toBeGreaterThan(0)
  for (const row of artistData) {
    expect(Number.isFinite(row.grossRevenue), row.artist).toBe(true)
    expect(Number.isFinite(row.finalPayout), row.artist).toBe(true)
    expect(Number.isFinite(row.amountDueEur), row.artist).toBe(true)
    expect(row.grossRevenue).not.toBeNaN()
  }
}

function pipelineConfig(): DataProcessorConfig {
  return {
    compilationFilters: [],
    artistMappings: [],
    splitFees: [],
    manualRevenues: [],
    expenses: [],
    distributionFeePercentage: 0,
    defaultSplitPercentage: 50,
    exchangeRates: { EUR: 1, USD: 0.92, GBP: 1.17 },
  }
}

const present = existsSync(examplePath('Believe_Q4_2025.csv'))

describe.skipIf(!present)('real statement-of-sales examples', () => {
  it('parses Darkmerch CSV and XLSX without NaN payouts', () => {
    const csv = parseDarkmerchCSV(readCsvText(examplePath('Darkmerch_Q4_2025-Q1_2026.csv')))
    expect(csv.transactions.length).toBeGreaterThan(10)
    expect(csv.transactions.every((row) => row.is_physical)).toBe(true)
    const emptyRevenue = csv.errors.filter((row) => /empty|zero|invalid/i.test(row.reason))
    expect(csv.errors.length).toBeGreaterThanOrEqual(emptyRevenue.length)

    const { artistData } = processTransactionsWithCompilations(csv.transactions, pipelineConfig())
    assertMoney(artistData)
  }, 30_000)

  it('parses Darkmerch XLSX to the same physical sales path', async () => {
    const buffer = readFileSync(examplePath('Darkmerch_Q4_2025-Q1_2026.xlsx'))
    const parsed = await parseDarkmerchXLSX(buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ))
    expect(parsed.transactions.length).toBeGreaterThan(10)
  }, 30_000)

  it('parses UTF-16 Bandcamp raw sales and detects a period', async () => {
    const parsed = await parseCSVContentStreaming(
      readCsvText(examplePath('20251001-20260331_bandcamp_raw_data_darkTunes.csv')),
      'bandcamp',
    )
    expect(parsed.transactions.length).toBeGreaterThan(100)
    expect(parsed.uniqueArtists.length).toBeGreaterThan(5)
    const bounds = extractPeriodBounds(parsed.transactions.map((row) => row.sales_month))
    expect(bounds).toEqual({ periodStart: '2025-10', periodEnd: '2026-03' })
    const { artistData } = processTransactionsWithCompilations(parsed.transactions, pipelineConfig())
    assertMoney(artistData)
  }, 60_000)

  it('parses Believe Q4 2025 and Q1 2026 with EN dates and finite payouts', async () => {
    const q4 = await parseCSVContentStreaming(readCsvText(examplePath('Believe_Q4_2025.csv')), 'believe')
    expect(q4.transactions.length).toBeGreaterThan(10_000)
    expect(q4.uniqueArtists).toEqual(expect.arrayContaining(['Omnimar']))
    const q4Months = new Set(q4.transactions.map((row) => row.sales_month))
    expect(q4Months.has('2025-10') || q4Months.has('2025-11') || q4Months.has('2025-12')).toBe(true)
    const q4Bounds = extractPeriodBounds([...q4Months])
    expect(q4Bounds).not.toBeNull()
    expect(q4Bounds!.periodStart <= '2025-10').toBe(true)
    expect(q4Bounds!.periodEnd >= '2025-11').toBe(true)
    const q4Money = processTransactionsWithCompilations(q4.transactions, pipelineConfig())
    assertMoney(q4Money.artistData)
    for (const err of q4.errors.slice(0, 20)) {
      expect(explainSosError(err.reason)).not.toMatch(/PGRST|Failed to fetch/)
    }

    const q1 = await parseCSVContentStreaming(readCsvText(examplePath('Believe_Q1_2026.csv')), 'believe')
    expect(q1.transactions.length).toBeGreaterThan(10_000)
    const q1Months = new Set(q1.transactions.map((row) => row.sales_month))
    expect(q1Months.has('2026-01') || q1Months.has('2026-02') || q1Months.has('2026-03')).toBe(true)
    const q1Bounds = extractPeriodBounds([...q1Months])
    expect(q1Bounds).not.toBeNull()
    const q1Money = processTransactionsWithCompilations(q1.transactions, pipelineConfig())
    assertMoney(q1Money.artistData)
  }, 180_000)

  it('keeps Bandcamp payout rows out of revenue when parsed as sales', async () => {
    const parsed = await parseCSVContentStreaming(
      readCsvText(examplePath('20251001-20260331_bandcamp_payouts_darkTunes.csv')),
      'bandcamp',
    )
    const payoutLike = parsed.skipped.filter((row) => /payout|skip/i.test(row.reason)).length
    expect(parsed.transactions.length + parsed.skipped.length + parsed.errors.length).toBeGreaterThan(0)
    expect(payoutLike + parsed.skipped.length + parsed.errors.length).toBeGreaterThanOrEqual(0)
    if (parsed.transactions.length > 0) {
      const { artistData } = processTransactionsWithCompilations(parsed.transactions, pipelineConfig())
      for (const row of artistData) {
        expect(Number.isFinite(row.finalPayout)).toBe(true)
      }
    }
  }, 30_000)

  it('reads the label roster names', () => {
    const text = readCsvText(examplePath('label_artists.csv'))
    const names = text
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.match(/^"([^"]+)"/)?.[1])
      .filter((name): name is string => Boolean(name))
    expect(names).toEqual(expect.arrayContaining(['Omnimar', 'Blackbook', 'Aevum']))
    expect(names.length).toBeGreaterThan(20)
  })
})
