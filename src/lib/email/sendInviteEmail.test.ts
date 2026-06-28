import { describe, it, expect, vi, beforeEach } from 'vitest'
import { INVITE_EMAIL_SUBJECT, sendInviteEmail } from './sendInviteEmail'
import { SITE_SETTINGS_DEFAULTS } from '@/lib/api/siteSettings'

const baseDeps = {
  recipientEmail: 'artist@example.com',
  inviteUrl: 'https://darktunes.com/auth/callback?invite=1&token_hash=abc&type=invite',
  settings: {
    ...SITE_SETTINGS_DEFAULTS,
    impressumCompanyName: 'darkTunes Music Group GmbH',
    impressumAddress: 'Musterstraße 1\n10115 Berlin',
    impressumEmail: 'legal@darktunes.com',
  },
  resendApiKey: 'test-resend-key',
  resendFromEmail: 'noreply@darktunes.com',
  siteUrl: 'https://darktunes.com',
  role: 'artist' as const,
}

function makeMockFetch(ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    text: async () => (ok ? '' : 'Internal Server Error'),
  })
}

describe('sendInviteEmail', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns error when resendApiKey is empty', async () => {
    const result = await sendInviteEmail({
      ...baseDeps,
      resendApiKey: '',
      fetch: makeMockFetch() as typeof fetch,
    })

    expect(result).toEqual({ success: false, error: 'RESEND_API_KEY not configured' })
  })

  it('sends branded invite via Resend with role and impressum footer', async () => {
    const mockFetch = makeMockFetch()

    const result = await sendInviteEmail({
      ...baseDeps,
      fetch: mockFetch as typeof fetch,
    })

    expect(result.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledOnce()

    const callArgs = mockFetch.mock.calls[0][1] as { body: string }
    const body = JSON.parse(callArgs.body) as {
      to: string[]
      subject: string
      from: string
      html: string
      text: string
    }

    expect(body.to).toEqual(['artist@example.com'])
    expect(body.subject).toBe(INVITE_EMAIL_SUBJECT)
    expect(body.from).toContain('darkTunes Music Group')
    expect(body.html).toContain('Accept invitation')
    expect(body.html).toContain('Artist')
    expect(body.html).toContain('darkTunes Music Group GmbH')
    expect(body.text).toContain(baseDeps.inviteUrl)
  })

  it('returns error when Resend API fails', async () => {
    const result = await sendInviteEmail({
      ...baseDeps,
      fetch: makeMockFetch(false) as typeof fetch,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })
})