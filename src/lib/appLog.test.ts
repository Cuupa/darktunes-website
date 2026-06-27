import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { writeAppLog } from './appLog'

const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockFrom = vi.fn(() => ({ insert: mockInsert }))
const mockCreateClient = vi.fn(() => ({ from: mockFrom }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}))

describe('writeAppLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('inserts app_logs row with service role client', async () => {
    await writeAppLog({
      source: 'api',
      level: 'error',
      message: 'Test failure',
      details: { path: '/api/test' },
      userId: 'user-abc',
    })

    expect(mockCreateClient).toHaveBeenCalled()
    expect(mockFrom).toHaveBeenCalledWith('app_logs')
    expect(mockInsert).toHaveBeenCalledWith({
      source: 'api',
      level: 'error',
      message: 'Test failure',
      details: { path: '/api/test' },
      user_id: 'user-abc',
    })
  })

  it('no-ops when Supabase env vars are missing', async () => {
    vi.unstubAllEnvs()
    await writeAppLog({ source: 'api', message: 'ignored' })
    expect(mockInsert).not.toHaveBeenCalled()
  })
})