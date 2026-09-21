import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const verifyAdmin = vi.fn()
const getSalesStatementById = vi.fn()
const getSignedUrl = vi.fn()

vi.mock('@/lib/adminAuth', () => ({
  extractBearerToken: (header: string | null) =>
    header ? header.replace(/^Bearer\s+/i, '') : null,
  verifyAdmin: (...args: unknown[]) => verifyAdmin(...args),
}))

vi.mock('@/lib/api/salesStatements', () => ({
  getSalesStatementById: (...args: unknown[]) => getSalesStatementById(...args),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({ kind: 'server' })),
}))

vi.mock('@/lib/r2Utils', () => ({
  createR2Client: vi.fn(() => ({ kind: 's3' })),
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrl(...args),
}))

vi.mock('@/lib/env.server', () => ({
  serverEnv: {
    CLOUDFLARE_R2_ACCOUNT_ID: 'acc',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'key',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'secret',
    CLOUDFLARE_R2_BUCKET_NAME: 'bucket',
  },
}))

const STATEMENT_ID = '55555555-5555-4555-8555-555555555555'

async function loadRoute() {
  vi.resetModules()
  return import('../../../app/api/admin/sales-statements/[id]/pdf/route')
}

function get() {
  return new NextRequest(`http://localhost/api/admin/sales-statements/${STATEMENT_ID}/pdf`, {
    headers: { Authorization: 'Bearer token' },
  })
}

describe('GET /api/admin/sales-statements/{id}/pdf', () => {
  beforeEach(() => {
    verifyAdmin.mockReset()
    getSalesStatementById.mockReset()
    getSignedUrl.mockReset()
    verifyAdmin.mockResolvedValue('admin-1')
    getSignedUrl.mockResolvedValue('https://signed.example/statement.pdf')
  })

  it('returns a presigned URL without leaking the R2 key', async () => {
    getSalesStatementById.mockResolvedValue({
      id: STATEMENT_ID,
      r2Key: 'statements/artist/Q1.pdf',
      status: 'draft',
    })

    const { GET } = await loadRoute()
    const response = await GET(get())
    const json = (await response.json()) as { url?: string; r2Key?: string }

    expect(response.status).toBe(200)
    expect(json.url).toBe('https://signed.example/statement.pdf')
    expect(json.r2Key).toBeUndefined()
    expect(getSignedUrl).toHaveBeenCalledWith(
      { kind: 's3' },
      expect.anything(),
      { expiresIn: 600 },
    )
  })

  it('returns 404 when the statement has no PDF object', async () => {
    getSalesStatementById.mockResolvedValue({
      id: STATEMENT_ID,
      r2Key: '',
      status: 'draft',
    })

    const { GET } = await loadRoute()
    const response = await GET(get())

    expect(response.status).toBe(404)
    expect(getSignedUrl).not.toHaveBeenCalled()
  })
})
