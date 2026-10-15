import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  abort: vi.fn(),
  clearTracked: vi.fn(),
}))

vi.mock('@/lib/r2Utils', () => ({
  listIncompleteMultipartUploads: mocks.list,
  abortMultipartUpload: mocks.abort,
  listR2ObjectsPage: vi.fn(),
}))
vi.mock('@/lib/api/distributorImportBatches', () => ({
  clearTrackedMultipartUpload: mocks.clearTracked,
}))

describe('abortStaleMultiparts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.abort.mockResolvedValue(undefined)
    mocks.clearTracked.mockResolvedValue(undefined)
  })

  it('aborts old incomplete uploads and clears matching SOS batch tracking', async () => {
    const now = Date.UTC(2026, 9, 15)
    mocks.list.mockResolvedValue([
      {
        key: 'sos-imports/batch-1/source.csv',
        uploadId: 'stuck-sos-upload',
        initiated: new Date(now - 25 * 60 * 60 * 1000),
      },
      {
        key: 'assets/stuck.jpg',
        uploadId: 'stuck-asset-upload',
        initiated: new Date(now - 25 * 60 * 60 * 1000),
      },
      {
        key: 'sos-imports/batch-2/source.csv',
        uploadId: 'recent-upload',
        initiated: new Date(now - 60 * 60 * 1000),
      },
    ])
    const { abortStaleMultiparts } = await import('./storageScan')

    const aborted = await abortStaleMultiparts({} as never, {} as never, 'bucket', now)

    expect(aborted).toBe(2)
    expect(mocks.abort).toHaveBeenCalledTimes(2)
    expect(mocks.clearTracked).toHaveBeenCalledTimes(1)
    expect(mocks.clearTracked).toHaveBeenCalledWith(
      expect.anything(),
      'sos-imports/batch-1/source.csv',
      'stuck-sos-upload',
    )
  })
})
