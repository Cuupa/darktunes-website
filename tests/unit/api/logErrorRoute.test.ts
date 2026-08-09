/**
 * Golden tests for POST /api/log-error — auth, Zammad gating, rate limit, validation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockWriteAppLog = vi.fn().mockResolvedValue(undefined)
const mockSubmitAutoErrorTicket = vi.fn()
const mockGetUser = vi.fn()
const mockResolveUserProfile = vi.fn()
const mockCreateServiceRoleSupabaseClient = vi.fn()
const mockCheckDistributedRateLimit = vi.fn()

vi.mock('@/lib/appLog', () => ({
  writeAppLog: (...args: unknown[]) => mockWriteAppLog(...args),
}))

vi.mock('@/lib/zammad/submitTicket', () => ({
  submitAutoErrorTicket: (...args: unknown[]) => mockSubmitAutoErrorTicket(...args),
}))

vi.mock('@/lib/api/zammadSupport', () => ({
  resolveUserProfile: (...args: unknown[]) => mockResolveUserProfile(...args),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
  createServiceRoleSupabaseClient: (...args: unknown[]) =>
    mockCreateServiceRoleSupabaseClient(...args),
}))

vi.mock('@/lib/rateLimitDistributed', () => ({
  checkDistributedRateLimit: (...args: unknown[]) => mockCheckDistributedRateLimit(...args),
}))

async function loadRoute() {
  vi.resetModules()
  return import('../../../app/api/log-error/route')
}

describe('POST /api/log-error', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@example.com', user_metadata: {} } },
    })
    mockCreateServiceRoleSupabaseClient.mockResolvedValue({})
    mockResolveUserProfile.mockResolvedValue({ email: 'user@example.com', name: 'User' })
    mockCheckDistributedRateLimit.mockResolvedValue({ limited: false, remaining: 60 })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  async function postLogError(body: Record<string, unknown>) {
    const { POST } = await loadRoute()
    const req = new NextRequest('http://localhost/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return POST(req)
  }

  it('401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await postLogError({ source: 'ui', message: 'x' })
    expect(res.status).toBe(401)
    expect(mockWriteAppLog).not.toHaveBeenCalled()
  })

  it('429 when rate limited', async () => {
    mockCheckDistributedRateLimit.mockResolvedValue({ limited: true, remaining: 0 })
    const res = await postLogError({ source: 'ui', message: 'x' })
    expect(res.status).toBe(429)
    expect(mockWriteAppLog).not.toHaveBeenCalled()
  })

  it('400 on invalid payload', async () => {
    const res = await postLogError({ source: '', message: '' })
    expect(res.status).toBe(400)
  })

  it('queues Zammad auto ticket only for exact ui source errors', async () => {
    const res = await postLogError({
      source: 'ui',
      message: 'Render crashed',
      level: 'error',
    })

    expect(res.status).toBe(201)
    expect(mockWriteAppLog).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'ui', message: 'Render crashed' }),
    )
    await vi.waitFor(() => {
      expect(mockSubmitAutoErrorTicket).toHaveBeenCalled()
    })
  })

  it('does not queue Zammad for admin.health (operational, non-ui)', async () => {
    const res = await postLogError({
      source: 'admin.health',
      message: 'Health check failed: 503',
      level: 'error',
    })

    expect(res.status).toBe(201)
    expect(mockWriteAppLog).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'admin.health' }),
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mockSubmitAutoErrorTicket).not.toHaveBeenCalled()
  })

  it('does not rewrite SOS sources to ui (no false Zammad tickets)', async () => {
    const res = await postLogError({
      source: 'sos.bronze.upload',
      message: 'Upload failed',
      level: 'error',
    })

    expect(res.status).toBe(201)
    expect(mockWriteAppLog).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'sos.bronze.upload' }),
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mockSubmitAutoErrorTicket).not.toHaveBeenCalled()
  })

  it('preserves useSosWorkspaceSync source without Zammad', async () => {
    const res = await postLogError({
      source: 'useSosWorkspaceSync',
      message: 'save failed',
      level: 'error',
    })
    expect(res.status).toBe(201)
    expect(mockWriteAppLog).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'useSosWorkspaceSync' }),
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mockSubmitAutoErrorTicket).not.toHaveBeenCalled()
  })
})
