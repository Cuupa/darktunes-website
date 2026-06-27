import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockWriteAppLog = vi.fn().mockResolvedValue(undefined)
const mockSubmitAutoErrorTicket = vi.fn()
const mockGetUser = vi.fn()
const mockResolveUserProfile = vi.fn()
const mockCreateServiceRoleSupabaseClient = vi.fn()

vi.mock('@/lib/appLog', () => ({
  writeAppLog: mockWriteAppLog,
}))

vi.mock('@/lib/zammad/submitTicket', () => ({
  submitAutoErrorTicket: mockSubmitAutoErrorTicket,
}))

vi.mock('@/lib/api/zammadSupport', () => ({
  resolveUserProfile: mockResolveUserProfile,
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
  createServiceRoleSupabaseClient: mockCreateServiceRoleSupabaseClient,
}))

describe('POST /api/log-error', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@example.com', user_metadata: {} } },
    })
    mockCreateServiceRoleSupabaseClient.mockResolvedValue({})
    mockResolveUserProfile.mockResolvedValue({ email: 'user@example.com', name: 'User' })
  })

  afterEach(() => {
    vi.resetModules()
  })

  async function postLogError(body: Record<string, unknown>) {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return POST(req)
  }

  it('queues Zammad auto ticket only for ui source errors', async () => {
    const res = await postLogError({
      source: 'ui',
      message: 'Render crashed',
      level: 'error',
    })

    expect(res.status).toBe(201)
    await vi.waitFor(() => {
      expect(mockSubmitAutoErrorTicket).toHaveBeenCalled()
    })
  })

  it('does not queue Zammad ticket for admin.health monitoring errors', async () => {
    const res = await postLogError({
      source: 'admin.health',
      message: 'Health check failed: 503',
      level: 'error',
    })

    expect(res.status).toBe(201)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(mockSubmitAutoErrorTicket).not.toHaveBeenCalled()
    expect(mockWriteAppLog).toHaveBeenCalled()
  })
})