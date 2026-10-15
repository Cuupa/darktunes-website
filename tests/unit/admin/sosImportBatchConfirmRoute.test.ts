import { CopyObjectCommand } from '@aws-sdk/client-s3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonRequest, readJson } from '../../helpers/api/routeTestkit'

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createDb: vi.fn(),
  getBatch: vi.fn(),
  findByHash: vi.fn(),
  finalizeBatch: vi.fn(),
  updateStatus: vi.fn(),
  setMultipart: vi.fn(),
  writeAppLog: vi.fn(),
  createR2Client: vi.fn(),
  hashR2Object: vi.fn(),
  deleteR2Object: vi.fn(),
}))

vi.mock('@/lib/adminAuth', () => ({
  requireAdminFromRequest: mocks.requireAdmin,
}))
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleSupabaseClient: mocks.createDb,
}))
vi.mock('@/lib/api/distributorImportBatches', () => ({
  finalizeImportBatch: mocks.finalizeBatch,
  findImportBatchByFileHash: mocks.findByHash,
  getImportBatchById: mocks.getBatch,
  setImportBatchMultipartUpload: mocks.setMultipart,
  updateImportBatchStatus: mocks.updateStatus,
}))
vi.mock('@/lib/appLog', () => ({ writeAppLog: mocks.writeAppLog }))
vi.mock('@/lib/r2Utils', () => ({
  createR2Client: mocks.createR2Client,
  deleteObjectFromR2: mocks.deleteR2Object,
  sha256HexFromR2Object: mocks.hashR2Object,
}))
vi.mock('@/lib/env.server', () => ({
  serverEnv: {
    CLOUDFLARE_R2_ACCOUNT_ID: 'account',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'access',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'secret',
    CLOUDFLARE_R2_BUCKET_NAME: 'bucket',
  },
}))

const batch = {
  id: 'e41a8676-0915-4a0e-9043-1b5b5326a77a',
  operationId: 'a15b2f59-9aec-478d-91b8-8be8b0dc9a12',
  r2Key: 'sos-imports/e41a8676/source.csv',
  fileHash: undefined,
  multipartUploadId: undefined,
  status: 'uploaded',
}
const FILE_HASH = 'ab'.repeat(32)

describe('PATCH /api/admin/sos/import-batches/{id}/confirm', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.requireAdmin.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    mocks.createDb.mockResolvedValue({ kind: 'service' })
    mocks.getBatch.mockResolvedValue(batch)
    mocks.findByHash.mockResolvedValue(null)
    mocks.finalizeBatch.mockResolvedValue(true)
    mocks.updateStatus.mockResolvedValue(undefined)
    mocks.setMultipart.mockResolvedValue(true)
    mocks.writeAppLog.mockResolvedValue(true)
    mocks.hashR2Object.mockResolvedValue(FILE_HASH)
    mocks.deleteR2Object.mockResolvedValue(undefined)
    mocks.createR2Client.mockReturnValue({ send: vi.fn().mockResolvedValue({}) })
  })

  it('copies to a private final key and records only that verified key as complete', async () => {
    const { PATCH } = await import('../../../app/api/admin/sos/import-batches/[id]/confirm/route')
    const { status, body } = await readJson<{ ok: boolean }>(
      await PATCH(
        jsonRequest(`/api/admin/sos/import-batches/${batch.id}/confirm`, {
          method: 'PATCH',
          bearer: 'admin-token',
          body: { file_hash: FILE_HASH, operation_id: batch.operationId },
        }),
      ),
    )

    const confirmedKey = `sos-imports/${batch.id}/confirmed/source.csv`
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mocks.hashR2Object).toHaveBeenCalledWith(confirmedKey, expect.anything(), 'bucket')
    expect(mocks.hashR2Object).toHaveBeenCalledTimes(1)
    expect(mocks.finalizeBatch).toHaveBeenCalledWith(expect.anything(), {
      id: batch.id,
      r2Key: confirmedKey,
      fileHash: FILE_HASH,
    })
    const s3 = mocks.createR2Client.mock.results[0]?.value as { send: ReturnType<typeof vi.fn> }
    const copy = s3.send.mock.calls.map(([command]) => command).find(
      (command) => command instanceof CopyObjectCommand,
    ) as CopyObjectCommand | undefined
    expect(copy?.input).toMatchObject({
      Bucket: 'bucket',
      CopySource: `bucket/${batch.r2Key}`,
      Key: confirmedKey,
      MetadataDirective: 'COPY',
    })
    expect(mocks.deleteR2Object).toHaveBeenCalledWith(batch.r2Key, s3, 'bucket')
  })

  it('does not recopy a confirmed archive or accept a different hash on retry', async () => {
    mocks.getBatch.mockResolvedValue({ ...batch, status: 'completed', fileHash: FILE_HASH })
    const { PATCH } = await import('../../../app/api/admin/sos/import-batches/[id]/confirm/route')
    const response = await PATCH(
      jsonRequest(`/api/admin/sos/import-batches/${batch.id}/confirm`, {
        method: 'PATCH',
        bearer: 'admin-token',
        body: { file_hash: FILE_HASH, operation_id: batch.operationId },
      }),
    )
    expect(response.status).toBe(200)
    expect(mocks.createR2Client).not.toHaveBeenCalled()
    expect(mocks.finalizeBatch).not.toHaveBeenCalled()
  })
})
