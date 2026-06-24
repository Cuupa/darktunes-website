import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('abandons the batch when server upload fails', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          batch: { id: 'batch-1' },
          r2Key: 'sos-imports/batch-1/file.csv',
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Unavailable',
        json: async () => ({ error: 'Service unavailable' }),
      })
      .mockResolvedValueOnce({ ok: true })

    const result = await uploadBronzeDistributorCsv({
      distributor: 'believe',
      filename: 'sales.csv',
      uploadBody: 'a,b\n1,2',
      rowCount: 1,
      periodStart: '2024-01',
      periodEnd: '2024-01',
    })

    expect(result).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/admin/sos/import-batches/batch-1/upload')
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' })
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/admin/sos/import-batches/batch-1')
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'DELETE' })
  })

  it('retries confirm and returns batch metadata on success', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          batch: { id: 'batch-2' },
          r2Key: 'sos-imports/batch-2/file.csv',
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true })

    const result = await uploadBronzeDistributorCsv({
      distributor: 'bandcamp',
      filename: 'report.csv',
      uploadBody: 'header\nvalue',
      rowCount: 1,
      periodStart: '2024-02',
      periodEnd: '2024-02',
    })

    expect(result).toEqual({ batchId: 'batch-2', r2Key: 'sos-imports/batch-2/file.csv' })
    const confirmCalls = fetchMock.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('/confirm'),
    )
    expect(confirmCalls).toHaveLength(2)
  })

  it('uses chunked multipart upload when CSV exceeds the server proxy limit', async () => {
    vi.resetModules()
    vi.doMock('./bronzeUploadLimits', () => ({
      MAX_BRONZE_CSV_SERVER_BYTES: 4,
      MAX_BRONZE_CSV_BYTES: 200,
      BRONZE_UPLOAD_CHUNK_BYTES: 3,
    }))
    const { uploadBronzeDistributorCsv: uploadLargeCsv } = await import('./bronzeUpload')

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          batch: { id: 'batch-large' },
          r2Key: 'sos-imports/batch-large/file.csv',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uploadId: 'upload-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ etag: 'etag-1', partNumber: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ etag: 'etag-2', partNumber: 2 }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: true })

    const result = await uploadLargeCsv({
      distributor: 'believe',
      filename: 'large.csv',
      uploadBody: 'abcdef',
      rowCount: 1,
      periodStart: '2024-04',
      periodEnd: '2024-04',
    })

    expect(result).toEqual({ batchId: 'batch-large', r2Key: 'sos-imports/batch-large/file.csv' })
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/admin/sos/import-batches/batch-large/multipart/init')
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/admin/sos/import-batches/batch-large/multipart/part')
    expect(fetchMock.mock.calls[3]?.[0]).toBe('/api/admin/sos/import-batches/batch-large/multipart/part')
    expect(fetchMock.mock.calls[4]?.[0]).toBe('/api/admin/sos/import-batches/batch-large/multipart/complete')

    vi.doUnmock('./bronzeUploadLimits')
    vi.resetModules()
  })

  it('marks the batch failed when confirm never succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          batch: { id: 'batch-3' },
          r2Key: 'sos-imports/batch-3/file.csv',
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true })

    const result = await uploadBronzeDistributorCsv({
      distributor: 'shopify',
      filename: 'orders.csv',
      uploadBody: 'x',
      rowCount: 1,
      periodStart: '2024-03',
      periodEnd: '2024-03',
    })

    expect(result).toBeNull()
    const failCall = fetchMock.mock.calls.find(
      (call) => call[0] === '/api/admin/sos/import-batches/batch-3' && call[1]?.method === 'PATCH',
    )
    expect(failCall?.[1]?.body).toBe(JSON.stringify({ status: 'failed' }))
  })
})