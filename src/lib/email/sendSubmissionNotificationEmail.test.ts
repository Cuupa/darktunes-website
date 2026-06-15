import { describe, it, expect, vi } from 'vitest'
import {
  sendSubmissionNotificationEmail,
  type SubmissionDetails,
  type SendSubmissionEmailDeps,
} from './sendSubmissionNotificationEmail'

const baseDetails: SubmissionDetails = {
  type: 'release',
  title: 'Neon Collapse',
  artistName: 'CryptoWave',
  submittedAt: '2025-01-15T10:30:00.000Z',
  adminUrl: 'https://darktunes.com/admin',
}

const baseDeps: SendSubmissionEmailDeps = {
  resendApiKey: 'test-api-key',
  resendFromEmail: 'noreply@darktunes.com',
  labelNotificationEmail: 'label@darktunes.com',
  fetch: vi.fn(),
}

describe('sendSubmissionNotificationEmail', () => {
  it('returns success: false when resendApiKey is empty', async () => {
    const deps = { ...baseDeps, resendApiKey: '' }
    const result = await sendSubmissionNotificationEmail(baseDetails, deps)
    expect(result).toEqual({ success: false, error: 'RESEND_API_KEY not configured' })
    expect(deps.fetch).not.toHaveBeenCalled()
  })

  it('returns success: false when labelNotificationEmail is empty', async () => {
    const fetchMock = vi.fn()
    const deps = { ...baseDeps, labelNotificationEmail: '', fetch: fetchMock }
    const result = await sendSubmissionNotificationEmail(baseDetails, deps)
    expect(result).toEqual({ success: false, error: 'LABEL_NOTIFICATION_EMAIL not configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends POST to Resend API with correct payload for a release', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    const deps = { ...baseDeps, fetch: fetchMock }

    const result = await sendSubmissionNotificationEmail(baseDetails, deps)

    expect(result).toEqual({ success: true })
    expect(fetchMock).toHaveBeenCalledOnce()

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.method).toBe('POST')

    const body = JSON.parse(init.body as string) as {
      from: string
      to: string[]
      subject: string
      html: string
    }
    expect(body.to).toEqual(['label@darktunes.com'])
    expect(body.subject).toContain('Release')
    expect(body.subject).toContain('Neon Collapse')
    expect(body.html).toContain('CryptoWave')
    expect(body.html).toContain('release-submissions')
  })

  it('uses correct tab param for a video submission', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    const deps = { ...baseDeps, fetch: fetchMock }
    const details: SubmissionDetails = { ...baseDetails, type: 'video', title: 'Club Night' }

    await sendSubmissionNotificationEmail(details, deps)

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string) as {
      subject: string
      html: string
    }
    expect(body.subject).toContain('Video')
    expect(body.html).toContain('video-submissions')
  })

  it('returns success: false when Resend API returns a non-OK response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => 'Unprocessable Entity',
    })
    const deps = { ...baseDeps, fetch: fetchMock }

    const result = await sendSubmissionNotificationEmail(baseDetails, deps)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Unprocessable Entity')
  })

  it('returns success: false when fetch throws a network error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network failure'))
    const deps = { ...baseDeps, fetch: fetchMock }

    const result = await sendSubmissionNotificationEmail(baseDetails, deps)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Network failure')
  })

  it('escapes HTML special characters in the title and artist name', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    const deps = { ...baseDeps, fetch: fetchMock }
    const details: SubmissionDetails = {
      ...baseDetails,
      title: '<script>alert("xss")</script>',
      artistName: 'Band & Friends',
    }

    await sendSubmissionNotificationEmail(details, deps)

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string) as {
      html: string
    }
    expect(body.html).not.toContain('<script>')
    expect(body.html).toContain('&lt;script&gt;')
    expect(body.html).toContain('Band &amp; Friends')
  })
})
