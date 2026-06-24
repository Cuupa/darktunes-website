import { describe, it, expect, vi, afterEach } from 'vitest'
import { extractPeriodBounds, uploadBronzeDistributorCsv } from './bronzeUpload'

describe('extractPeriodBounds', () => {
  it('returns min and max valid YYYY-MM months', () => {
    expect(extractPeriodBounds(['2024-03', '2024-01', 'invalid', '2024-06'])).toEqual({
      periodStart: '2024-01',
      periodEnd: '2024-06',
    })
  })

  it('falls back to current month when no valid months', () => {
    const fallback = new Date().toISOString().slice(0, 7)
    expect(extractPeriodBounds(['Unknown', ''])).toEqual({
      periodStart: fallback,
      periodEnd: fallback,
    })
  })
})

describe('uploadBronzeDistributorCsv', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uploads CSV via the server route without a presigned PUT', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        batch: { id: 'batch-1' },
        r2Key: 'sos-imports/batch-1/hash_test.csv',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await uploadBronzeDistributorCsv({
      distributor: 'believe',
      filename: 'Believe_Q1.csv',
      csvContent: 'artist,revenue\nTest,1.00',
      rowCount: 1,
      periodStart: '2026-01',
      periodEnd: '2026-03',
    })

    expect(result).toEqual({
      batchId: 'batch-1',
      r2Key: 'sos-imports/batch-1/hash_test.csv',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    const body = JSON.parse(String(init.body)) as { csv_content?: string; uploadUrl?: string }
    expect(body.csv_content).toBe('artist,revenue\nTest,1.00')
    expect(body.uploadUrl).toBeUndefined()
  })
})