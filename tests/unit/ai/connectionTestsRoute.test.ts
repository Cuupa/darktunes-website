import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonRequest, expectUnauthorized, expectStatus } from '../../helpers/api/routeTestkit'

const requireAdminWithServiceClient = vi.fn()
const resolveNvidiaApiKey = vi.fn()
const runNvidiaConnectionTest = vi.fn()
const checkDistributedRateLimit = vi.fn()

vi.mock('@/lib/adminAuth', () => ({
  requireAdminWithServiceClient: (...args: unknown[]) => requireAdminWithServiceClient(...args),
}))

vi.mock('@/lib/ai/provider/resolveKey', () => ({
  resolveNvidiaApiKey: (...args: unknown[]) => resolveNvidiaApiKey(...args),
}))

vi.mock('@/lib/ai/provider/connectionTest', () => ({
  runNvidiaConnectionTest: (...args: unknown[]) => runNvidiaConnectionTest(...args),
}))

vi.mock('@/lib/rateLimitDistributed', () => ({
  checkDistributedRateLimit: (...args: unknown[]) => checkDistributedRateLimit(...args),
}))

async function importRoute() {
  return import('../../../app/api/admin/ai/connection-tests/route')
}

describe('POST /api/admin/ai/connection-tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdminWithServiceClient.mockResolvedValue({
      userId: 'admin-1',
      role: 'admin',
      serviceClient: {},
    })
    checkDistributedRateLimit.mockResolvedValue({ limited: false, backend: 'memory' })
  })

  it('should reject unauthenticated callers', async () => {
    const { ApiError } = await import('@/lib/errors')
    requireAdminWithServiceClient.mockRejectedValue(new ApiError(401, 'Unauthorized'))
    const { POST } = await importRoute()
    const res = await POST(jsonRequest('/api/admin/ai/connection-tests', { method: 'POST', body: {} }))
    await expectUnauthorized(res)
    expect(runNvidiaConnectionTest).not.toHaveBeenCalled()
  })

  it('should return AI_NOT_CONFIGURED when no key is stored or in env', async () => {
    resolveNvidiaApiKey.mockResolvedValue(null)
    const { POST } = await importRoute()
    const res = await POST(
      jsonRequest('/api/admin/ai/connection-tests', { method: 'POST', body: {}, bearer: 'token' }),
    )
    const body = await expectStatus<{ code: string }>(res, 503)
    expect(body.code).toBe('AI_NOT_CONFIGURED')
    expect(runNvidiaConnectionTest).not.toHaveBeenCalled()
  })

  it('should return the probe result without retrying', async () => {
    resolveNvidiaApiKey.mockResolvedValue('nvapi-test')
    runNvidiaConnectionTest.mockResolvedValue({
      ok: true,
      started_at: '2026-10-20T00:00:00.000Z',
      finished_at: '2026-10-20T00:00:01.000Z',
      total_latency_ms: 1000,
      steps: [{ step: 'auth', ok: true, latency_ms: 1, error_code: null, detail: null }],
      discovered_capabilities: {},
      usage: { fast: { input_tokens: 1, output_tokens: 1, reasoning_tokens: 0, total_tokens: 2 }, reasoning: null },
    })
    const { POST } = await importRoute()
    const res = await POST(
      jsonRequest('/api/admin/ai/connection-tests', { method: 'POST', body: {}, bearer: 'token' }),
    )
    const body = await expectStatus<{ ok: boolean }>(res, 200)
    expect(body.ok).toBe(true)
    expect(runNvidiaConnectionTest).toHaveBeenCalledOnce()
  })
})
