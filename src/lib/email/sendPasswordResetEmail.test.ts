import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  PASSWORD_RESET_EMAIL_SUBJECT,
  sendPasswordResetEmail,
} from './sendPasswordResetEmail'
import { SITE_SETTINGS_DEFAULTS } from '@/lib/api/siteSettings'

const baseDeps = {
  recipientEmail: 'user@example.com',
  resetUrl: 'https://darktunes.com/login?type=recovery&code=abc123&token=xyz',
  settings: {
    ...SITE_SETTINGS_DEFAULTS,
    impressumCompanyName: 'darkTunes Music Group GmbH',
    impressumAddress: 'Musterstraße 1\n10115 Berlin',
    impressumEmail: 'legal@darktunes.com',
  },
  resendApiKey: 'test-resend-key',
  resendFromEmail: 'noreply@darktunes.com',
  siteUrl: 'https://darktunes.com',
}

function makeMockFetch(ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    text: async () => (ok ? '' : 'Internal Server Error'),
  })
}

describe('sendPasswordResetEmail', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns error when resendApiKey is empty', async () => {
    const result = await sendPasswordResetEmail({
      ...baseDeps,
      resendApiKey: '',
      fetch: makeMockFetch() as typeof fetch,
    })

    expect(result).toEqual({ success: false, error: 'RESEND_API_KEY not configured' })
  })

  it('sends branded email via Resend with reset link and impressum footer', async () => {
    const mockFetch = makeMockFetch()

    const result = await sendPasswordResetEmail({
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

    expect(body.to).toEqual(['user@example.com'])
    expect(body.subject).toBe(PASSWORD_RESET_EMAIL_SUBJECT)
    expect(body.from).toContain(SITE_SETTINGS_DEFAULTS.labelName)
    expect(body.html).toContain('Reset password')
    expect(body.html).toContain('type=recovery&amp;code=abc123&amp;token=xyz')
    expect(body.html).not.toMatch(/href="[^"]*&code=/)
    expect(body.html).toContain('darkTunes Music Group GmbH')
    expect(body.html).toContain('legal@darktunes.com')
    expect(body.text).toContain(baseDeps.resetUrl)
  })

  it('returns error when Resend API fails', async () => {
    const result = await sendPasswordResetEmail({
      ...baseDeps,
      fetch: makeMockFetch(false) as typeof fetch,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })
})