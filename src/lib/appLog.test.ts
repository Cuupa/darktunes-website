import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { writeAppLog, _resetLogClientForTests } from './appLog'

const { mockInsert, mockFrom, mockRpc, mockCreateClient } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockResolvedValue({ error: null })
  const mockFrom = vi.fn(() => ({ insert: mockInsert }))
  const mockRpc = vi.fn().mockResolvedValue({ error: null })
  const mockCreateClient = vi.fn(() => ({ from: mockFrom, rpc: mockRpc }))
  return { mockInsert, mockFrom, mockRpc, mockCreateClient }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}))

describe('writeAppLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetLogClientForTests()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('upserts via rpc and skips insert', async () => {
    await writeAppLog({
      source: 'api',
      level: 'error',
      message: 'Test failure',
      details: { path: '/api/test' },
      userId: 'user-abc',
      routePath: '/api/test',
    })

    expect(mockCreateClient).toHaveBeenCalled()
    expect(mockRpc).toHaveBeenCalledWith(
      'upsert_app_log',
      expect.objectContaining({
        p_source: 'api',
        p_level: 'error',
        p_message: 'Test failure',
        p_user_id: 'user-abc',
        p_route_path: '/api/test',
        p_fingerprint: expect.stringMatching(/^fp_/),
      }),
    )
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('scrubs PII and tokens from the persisted message', async () => {
    await writeAppLog({
      source: 'api',
      message: 'contact a@b.com Bearer secret-token ref 123456789',
    })

    expect(mockRpc).toHaveBeenCalledWith(
      'upsert_app_log',
      expect.objectContaining({
        p_message: 'contact [redacted] Bearer [redacted] ref 123456789',
      }),
    )
  })

  it('falls back to insert without fingerprint when rpc fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockRpc.mockResolvedValueOnce({ error: { message: 'function missing' } })

    await writeAppLog({
      source: 'api',
      level: 'error',
      message: 'Test failure',
      routePath: '/api/test',
    })

    expect(mockFrom).toHaveBeenCalledWith('app_logs')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'api',
        level: 'error',
        message: 'Test failure',
        fingerprint: null,
        route_path: '/api/test',
      }),
    )
    expect(consoleSpy).toHaveBeenCalledWith('error log rpc failed', expect.anything())
    consoleSpy.mockRestore()
  })

  it('logs persist failures instead of swallowing them', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockRpc.mockResolvedValueOnce({ error: { message: 'rpc down' } })
    mockInsert.mockResolvedValueOnce({ error: { message: 'insert down' } })

    await writeAppLog({ source: 'api', message: 'boom' })

    expect(consoleSpy).toHaveBeenCalledWith('error log persist failed', expect.anything())
    consoleSpy.mockRestore()
  })

  it('logs when Supabase env vars are missing', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.unstubAllEnvs()
    await writeAppLog({ source: 'api', message: 'ignored' })
    expect(mockInsert).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('error log persist skipped'),
    )
    consoleSpy.mockRestore()
  })

  it('no-ops when APP_ERROR_LOG_DISABLED is true', async () => {
    vi.stubEnv('APP_ERROR_LOG_DISABLED', 'true')
    await writeAppLog({ source: 'api', message: 'ignored' })
    expect(mockRpc).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
  })
})
