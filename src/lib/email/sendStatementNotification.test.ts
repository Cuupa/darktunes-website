import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendStatementNotification } from './sendStatementNotification'
import type { Artist } from '@/types'

const mockArtist: Artist = {
  id: 'artist-uuid-123',
  name: 'Test Artist',
  slug: 'test-artist',
  bio: '',
  genres: [],
  imageUrl: '',
  featured: false,
  isVisible: true,
  email: 'artist@example.com',
}

const mockStatement = {
  filename: 'Q1-2024.pdf',
  period: 'Q1-2024',
  amountEur: 1250.5,
}

const baseDeps = {
  resendApiKey: 'test-resend-key',
  resendFromEmail: 'noreply@test.com',
  siteUrl: 'https://test.com',
}

function makeMockFetch(ok = true, responseJson: unknown = { id: 'email-id-123' }) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => responseJson,
    text: async () => (ok ? JSON.stringify(responseJson) : 'Internal Server Error'),
  })
}

describe('sendStatementNotification', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends email via Resend API with correct payload', async () => {
    const mockFetch = makeMockFetch()

    const result = await sendStatementNotification(mockArtist, mockStatement, {
      ...baseDeps,
      fetch: mockFetch as typeof fetch,
    })

    expect(result.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-resend-key',
          'Content-Type': 'application/json',
        }),
      }),
    )

    const callArgs = mockFetch.mock.calls[0][1] as { body: string }
    const body = JSON.parse(callArgs.body) as {
      to: string[]
      subject: string
      from: string
    }
    expect(body.to).toEqual(['artist@example.com'])
    expect(body.subject).toBe('New Statement of Sales Available – Q1-2024')
    expect(body.from).toContain('darkTunes')
  })

  it('returns error when artist has no email address', async () => {
    const mockFetch = makeMockFetch()
    const artistWithoutEmail: Artist = { ...mockArtist, email: undefined }

    const result = await sendStatementNotification(artistWithoutEmail, mockStatement, {
      ...baseDeps,
      fetch: mockFetch as typeof fetch,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('no email address')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('handles Resend API errors gracefully (returns success: false)', async () => {
    const mockFetch = makeMockFetch(false)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const result = await sendStatementNotification(mockArtist, mockStatement, {
      ...baseDeps,
      fetch: mockFetch as typeof fetch,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('skips email when RESEND_API_KEY is not configured', async () => {
    const mockFetch = makeMockFetch()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const result = await sendStatementNotification(mockArtist, mockStatement, {
      ...baseDeps,
      resendApiKey: '',
      fetch: mockFetch as typeof fetch,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('RESEND_API_KEY not configured')
    expect(mockFetch).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('includes amount in email body when amountEur is provided', async () => {
    const mockFetch = makeMockFetch()

    await sendStatementNotification(
      mockArtist,
      { filename: 'Q1-2024.pdf', period: 'Q1-2024', amountEur: 1250.5 },
      { ...baseDeps, fetch: mockFetch as typeof fetch },
    )

    const callArgs = mockFetch.mock.calls[0][1] as { body: string }
    const body = JSON.parse(callArgs.body) as { html: string }
    expect(body.html).toContain('1250.50')
  })

  it('omits amount from email when amountEur is undefined', async () => {
    const mockFetch = makeMockFetch()

    await sendStatementNotification(
      mockArtist,
      { filename: 'Q1-2024.pdf', period: 'Q1-2024', amountEur: undefined },
      { ...baseDeps, fetch: mockFetch as typeof fetch },
    )

    const callArgs = mockFetch.mock.calls[0][1] as { body: string }
    const body = JSON.parse(callArgs.body) as { html: string }
    // The amount line with the EUR symbol should not appear
    expect(body.html).not.toContain('&#x20AC;')
  })
})
