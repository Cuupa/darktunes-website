import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonRequest, readJson } from '../../helpers/api/routeTestkit'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createDb: vi.fn(),
  getBatch: vi.fn(),
  setMultipart: vi.fn(),
  createR2Context: vi.fn(),
  getWritableBatch: vi.fn(),
  objectExists: vi.fn(),
  initMultipart: vi.fn(),
  abortMultipart: vi.fn(),
}))

vi.mock('@/lib/adminAuth', () => ({ requireAdminFromRequest: mocks.requireAdmin }))
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleSupabaseClient: mocks.createDb,
}))
vi.mock('@/lib/api/distributorImportBatches', () => ({
  getImportBatchById: mocks.getBatch,
  setImportBatchMultipartUpload: mocks.setMultipart,
}))
vi.mock('@/lib/sos/bronzeMultipartUpload', () => ({
  createBronzeMultipartR2Context: mocks.createR2Context,
  getWritableImportBatch: mocks.getWritableBatch,
  bronzeObjectExists: mocks.objectExists,
  initBronzeMultipartUpload: mocks.initMultipart,
  abortBronzeMultipartUpload: mocks.abortMultipart,
}))

const batch = {
  id: 'e41a8676-0915-4a0e-9043-1b5b5326a77a',
  r2Key: 'sos-imports/e41a8676/source.csv',
  status: 'uploaded',
  multipartUploadId: undefined,
}
const context = { s3: {}, bucket: 'bronze' }

describe('SOS multipart upload lifecycle routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.requireAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    mocks.createDb.mockResolvedValue({ kind: 'service' })
    mocks.getBatch.mockResolvedValue(batch)
    mocks.setMultipart.mockResolvedValue(true)
    mocks.createR2Context.mockResolvedValue(context)
    mocks.getWritableBatch.mockResolvedValue(batch)
    mocks.objectExists.mockResolvedValue(false)
    mocks.initMultipart.mockResolvedValue('upload-new')
    mocks.abortMultipart.mockResolvedValue(undefined)
  })

  it('stores the R2 upload ID before returning it to the browser', async () => {
    const { POST } = await import('../../../app/api/admin/sos/import-batches/[id]/multipart/init/route')
    const { status, body } = await readJson<{ uploadId: string }>(
      await POST(
        jsonRequest(`/api/admin/sos/import-batches/${batch.id}/multipart/init`, {
          method: 'POST',
          bearer: 'admin-token',
          body: { content_type: 'text/csv', file_size: 64 * 1024 * 1024 },
        }),
      ),
    )

    expect(status).toBe(200)
    expect(body.uploadId).toBe('upload-new')
    expect(mocks.setMultipart).toHaveBeenCalledWith(
      expect.anything(),
      batch.id,
      'upload-new',
      expect.any(String),
      true,
    )
  })

  it('reuses a tracked multipart session after a lost init response', async () => {
    mocks.getWritableBatch.mockResolvedValue({ ...batch, multipartUploadId: 'upload-stuck' })
    const { POST } = await import('../../../app/api/admin/sos/import-batches/[id]/multipart/init/route')
    const { status, body } = await readJson<{ uploadId: string }>(
      await POST(
      jsonRequest(`/api/admin/sos/import-batches/${batch.id}/multipart/init`, {
        method: 'POST',
        bearer: 'admin-token',
        body: { content_type: 'text/csv', file_size: 64 * 1024 * 1024 },
      }),
      ),
    )

    expect(status).toBe(200)
    expect(body.uploadId).toBe('upload-stuck')
    expect(mocks.initMultipart).not.toHaveBeenCalled()
    expect(mocks.abortMultipart).not.toHaveBeenCalled()
  })

  it('skips a multipart transfer when a prior complete request created the object', async () => {
    mocks.getWritableBatch.mockResolvedValue({ ...batch, multipartUploadId: 'upload-completed' })
    mocks.objectExists.mockResolvedValue(true)
    const { POST } = await import('../../../app/api/admin/sos/import-batches/[id]/multipart/init/route')
    const { status, body } = await readJson<{ completed: boolean; uploadId: null }>(
      await POST(
        jsonRequest(`/api/admin/sos/import-batches/${batch.id}/multipart/init`, {
          method: 'POST',
          bearer: 'admin-token',
          body: { content_type: 'text/csv', file_size: 64 * 1024 * 1024 },
        }),
      ),
    )

    expect(status).toBe(200)
    expect(body).toEqual({ uploadId: null, completed: true })
    expect(mocks.setMultipart).toHaveBeenCalledWith(expect.anything(), batch.id, null)
    expect(mocks.initMultipart).not.toHaveBeenCalled()
  })

  it('aborts a tracked upload even when the browser no longer has its upload ID', async () => {
    mocks.getWritableBatch.mockResolvedValue({ ...batch, multipartUploadId: 'upload-stuck' })
    const { POST } = await import('../../../app/api/admin/sos/import-batches/[id]/multipart/abort/route')
    const response = await POST(
      jsonRequest(`/api/admin/sos/import-batches/${batch.id}/multipart/abort`, {
        method: 'POST',
        bearer: 'admin-token',
      }),
    )

    expect(response.status).toBe(200)
    expect(mocks.abortMultipart).toHaveBeenCalledWith(context, batch.r2Key, 'upload-stuck')
    expect(mocks.setMultipart).toHaveBeenCalledWith(expect.anything(), batch.id, null)
  })
})
