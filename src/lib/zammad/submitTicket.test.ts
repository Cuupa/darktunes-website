import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateZammadTicket = vi.fn()
const mockIsKnownErrorFingerprint = vi.fn()
const mockHasRecentDuplicateTicket = vi.fn()
const mockInsertTicketLog = vi.fn()
const mockFrom = vi.fn()
const mockCreateClient = vi.fn()

vi.mock('./client', () => ({
  createZammadTicket: mockCreateZammadTicket,
}))

vi.mock('@/lib/api/zammadSupport', () => ({
  isKnownErrorFingerprint: mockIsKnownErrorFingerprint,
  hasRecentDuplicateTicket: mockHasRecentDuplicateTicket,
  insertTicketLog: mockInsertTicketLog,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}))

describe('submitAutoErrorTicket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
    vi.stubEnv('ZAMMAD_URL', 'https://zammad.example.com')
    vi.stubEnv('ZAMMAD_API_TOKEN', 'zammad-token')

    mockCreateClient.mockReturnValue({ from: mockFrom })
    mockIsKnownErrorFingerprint.mockResolvedValue(false)
    mockHasRecentDuplicateTicket.mockResolvedValue(false)
    mockInsertTicketLog.mockResolvedValue(undefined)
    mockCreateZammadTicket.mockResolvedValue({ ticketId: 42 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sends ticket and logs sent status', async () => {
    const { submitAutoErrorTicket } = await import('./submitTicket')

    submitAutoErrorTicket({
      userId: 'user-1',
      customerEmail: 'admin@darktunes.com',
      customerName: 'Admin User',
      source: 'ui',
      message: 'Render failed',
      viewPath: '/admin/artists',
    })

    await vi.waitFor(() => {
      expect(mockCreateZammadTicket).toHaveBeenCalled()
    })

    expect(mockCreateZammadTicket.mock.calls[0][1].customerEmail).toBe('admin@darktunes.com')
    expect(mockInsertTicketLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'sent', zammad_ticket_id: 42, ticket_type: 'auto_error' }),
    )
  })

  it('blocks known error fingerprints', async () => {
    mockIsKnownErrorFingerprint.mockResolvedValue(true)
    const { submitAutoErrorTicket } = await import('./submitTicket')

    submitAutoErrorTicket({
      userId: 'user-1',
      customerEmail: 'admin@darktunes.com',
      customerName: 'Admin',
      source: 'ui',
      message: 'Known bug',
    })

    await vi.waitFor(() => {
      expect(mockInsertTicketLog).toHaveBeenCalled()
    })

    expect(mockCreateZammadTicket).not.toHaveBeenCalled()
    expect(mockInsertTicketLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'blocked_known' }),
    )
  })

  it('skips auto ticket when dedup checks fail', async () => {
    mockIsKnownErrorFingerprint.mockRejectedValue(new Error('db unavailable'))
    const { submitAutoErrorTicket } = await import('./submitTicket')

    submitAutoErrorTicket({
      userId: 'user-1',
      customerEmail: 'admin@darktunes.com',
      customerName: 'Admin',
      source: 'ui',
      message: 'Error',
    })

    await vi.waitFor(() => {
      expect(mockInsertTicketLog).toHaveBeenCalled()
    })

    expect(mockCreateZammadTicket).not.toHaveBeenCalled()
    expect(mockInsertTicketLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'skipped' }),
    )
  })

  it('logs blocked_unconfigured when Zammad env is missing', async () => {
    vi.unstubAllEnvs()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')

    const { submitAutoErrorTicket } = await import('./submitTicket')

    submitAutoErrorTicket({
      userId: 'user-1',
      customerEmail: 'admin@darktunes.com',
      customerName: 'Admin',
      source: 'ui',
      message: 'Error',
    })

    await vi.waitFor(() => {
      expect(mockInsertTicketLog).toHaveBeenCalled()
    })

    expect(mockCreateZammadTicket).not.toHaveBeenCalled()
    expect(mockInsertTicketLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'blocked_unconfigured' }),
    )
  })
})