import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  extractPeriodBounds,
  humanizeBronzeUploadError,
  uploadBronzeDistributorCsv,
} from './bronzeUpload'

vi.mock('@/lib/sos/clientAppLog', () => ({
  logClientAppEvent: vi.fn(async () => undefined),
}))

describe('humanizeBronzeUploadError', () => {
  it('rewrites Failed to fetch without blaming file size', () => {
    expect(humanizeBronzeUploadError('Failed to fetch')).toMatch(/could not reach the server/i)
    expect(humanizeBronzeUploadError('Failed to fetch')).not.toMatch(/size/i)
    expect(humanizeBronzeUploadError('R2 PUT failed (403)')).toMatch(/file archive refused/i)
    expect(humanizeBronzeUploadError('R2 PUT failed (403)')).not.toMatch(/R2|403/)
  })
})

describe('extractPeriodBounds', () => {
  it('returns min and max valid YYYY-MM months', () => {
    expect(extractPeriodBounds(['2024-03', '2024-01', 'invalid', '2024-06'])).toEqual({
      periodStart: '2024-01',
      periodEnd: '2024-06',
    })
  })

  it('returns null instead of inventing the current month when no valid months exist', () => {
    expect(extractPeriodBounds(['Unknown', ''])).toBeNull()
    expect(extractPeriodBounds([])).toBeNull()
  })
})

describe('uploadBronzeDistributorCsv', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('NEXT_PUBLIC_BRONZE_DIRECT_UPLOAD', 'false')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
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

    expect(result).toEqual({ ok: false, message: 'Service unavailable' })
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

    expect(result).toEqual({ ok: true, batchId: 'batch-2', r2Key: 'sos-imports/batch-2/file.csv' })
    const confirmCalls = fetchMock.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('/confirm'),
    )
    expect(confirmCalls).toHaveLength(2)
  })

  it('reports a clear error when direct upload is disabled and the file exceeds the proxy limit', async () => {
    vi.resetModules()
    vi.doMock('./bronzeUploadLimits', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./bronzeUploadLimits')>()
      return {
        ...actual,
        MAX_BRONZE_CSV_SERVER_BYTES: 4,
        MAX_BRONZE_CSV_BYTES: 200,
      }
    })
    const { uploadBronzeDistributorCsv: uploadLargeCsv } = await import('./bronzeUpload')

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          batch: { id: 'batch-large' },
          r2Key: 'sos-imports/batch-large/file.csv',
        }),
      })
      .mockResolvedValueOnce({ ok: true })

    const result = await uploadLargeCsv({
      distributor: 'believe',
      filename: 'large.csv',
      uploadBody: 'abcdef',
      rowCount: 1,
      periodStart: '2024-04',
      periodEnd: '2024-04',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('Direct R2 upload is disabled')
    }
    const urls = fetchMock.mock.calls.map((call) => call[0])
    expect(urls.some((url) => typeof url === 'string' && url.includes('/multipart/'))).toBe(false)

    vi.doUnmock('./bronzeUploadLimits')
    vi.resetModules()
  })

  it('uses direct multipart above the single-PUT limit and never the proxy part route', async () => {
    vi.stubEnv('NEXT_PUBLIC_BRONZE_DIRECT_UPLOAD', 'true')
    vi.resetModules()
    vi.doMock('./bronzeUploadLimits', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./bronzeUploadLimits')>()
      return {
        ...actual,
        BRONZE_SINGLE_PUT_MAX_BYTES: 4,
        BRONZE_DIRECT_UPLOAD_PART_BYTES: 3,
        BRONZE_R2_MIN_PART_BYTES: 3,
        MAX_BRONZE_CSV_BYTES: 200,
      }
    })
    const { uploadBronzeDistributorCsv: uploadLargeCsv } = await import('./bronzeUpload')

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          batch: { id: 'batch-multi' },
          r2Key: 'sos-imports/batch-multi/file.csv',
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ uploadId: 'upload-1' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uploadUrl: 'https://r2.example/part-1' }),
      })
      .mockResolvedValueOnce({ ok: true, headers: { get: () => '"etag-1"' } })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uploadUrl: 'https://r2.example/part-2' }),
      })
      .mockResolvedValueOnce({ ok: true, headers: { get: () => '"etag-2"' } })
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

    expect(result).toEqual({
      ok: true,
      batchId: 'batch-multi',
      r2Key: 'sos-imports/batch-multi/file.csv',
    })
    const urls = fetchMock.mock.calls.map((call) => call[0])
    expect(urls[1]).toBe('/api/admin/sos/import-batches/batch-multi/multipart/init')
    expect(urls[2]).toBe('/api/admin/sos/import-batches/batch-multi/multipart/presign-part')
    expect(urls[3]).toBe('https://r2.example/part-1')
    expect(urls[4]).toBe('/api/admin/sos/import-batches/batch-multi/multipart/presign-part')
    expect(urls[5]).toBe('https://r2.example/part-2')
    expect(urls[6]).toBe('/api/admin/sos/import-batches/batch-multi/multipart/complete')
    expect(urls.some((url) => typeof url === 'string' && url.includes('/multipart/part'))).toBe(false)

    vi.doUnmock('./bronzeUploadLimits')
    vi.resetModules()
  })

  it('aborts the direct multipart session when a part request fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_BRONZE_DIRECT_UPLOAD', 'true')
    vi.resetModules()
    vi.doMock('./bronzeUploadLimits', async (importOriginal) => {
      const actual = await importOriginal<typeof import('./bronzeUploadLimits')>()
      return {
        ...actual,
        BRONZE_SINGLE_PUT_MAX_BYTES: 4,
        BRONZE_DIRECT_UPLOAD_PART_BYTES: 3,
        BRONZE_R2_MIN_PART_BYTES: 3,
        MAX_BRONZE_CSV_BYTES: 200,
      }
    })
    const { uploadBronzeDistributorCsv: uploadLargeCsv } = await import('./bronzeUpload')

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          batch: { id: 'batch-abort' },
          r2Key: 'sos-imports/batch-abort/file.csv',
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ uploadId: 'upload-2' }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Error',
        json: async () => ({ error: 'presign failed' }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true })

    const result = await uploadLargeCsv({
      distributor: 'believe',
      filename: 'large.csv',
      uploadBody: 'abcdef',
      rowCount: 1,
      periodStart: '2024-04',
      periodEnd: '2024-04',
    })

    expect(result).toEqual({ ok: false, message: 'presign failed' })
    const abortCall = fetchMock.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' &&
        call[0] === '/api/admin/sos/import-batches/batch-abort/multipart/abort',
    )
    expect(abortCall).toBeTruthy()
    expect(abortCall?.[1]?.body).toBe(JSON.stringify({ upload_id: 'upload-2' }))

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

    expect(result).toEqual({ ok: false, message: 'Archive confirm failed after upload' })
    const failCall = fetchMock.mock.calls.find(
      (call) => call[0] === '/api/admin/sos/import-batches/batch-3' && call[1]?.method === 'PATCH',
    )
    expect(failCall?.[1]?.body).toBe(JSON.stringify({ status: 'failed' }))
  })

  it('uses presigned direct upload when enabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_BRONZE_DIRECT_UPLOAD', 'true')

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          batch: { id: 'batch-direct' },
          r2Key: 'sos-imports/batch-direct/file.csv',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uploadUrl: 'https://r2.example/presigned-put' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => '"etag-direct"' },
      })
      .mockResolvedValueOnce({ ok: true })

    const result = await uploadBronzeDistributorCsv({
      distributor: 'believe',
      filename: 'direct.csv',
      uploadBody: 'a,b\n1,2',
      rowCount: 1,
      periodStart: '2024-05',
      periodEnd: '2024-05',
    })

    expect(result).toEqual({
      ok: true,
      batchId: 'batch-direct',
      r2Key: 'sos-imports/batch-direct/file.csv',
    })
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/admin/sos/import-batches/batch-direct/presign-upload',
    )
    expect(fetchMock.mock.calls[2]?.[0]).toBe('https://r2.example/presigned-put')
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'PUT' })
  })

  it('skips R2 upload when register reports a completed duplicate', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        duplicate: true,
        batch: { id: 'batch-existing', r2Key: 'sos-imports/batch-existing/file.csv' },
      }),
    })

    const result = await uploadBronzeDistributorCsv({
      distributor: 'believe',
      filename: 'sales.csv',
      uploadBody: 'a,b\n1,2',
      rowCount: 1,
      periodStart: '2024-01',
      periodEnd: '2024-01',
    })

    expect(result).toEqual({
      ok: true,
      batchId: 'batch-existing',
      r2Key: 'sos-imports/batch-existing/file.csv',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/admin/sos/import-batches')
  })
})