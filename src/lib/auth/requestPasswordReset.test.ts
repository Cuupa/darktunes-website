import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requestPasswordReset } from './requestPasswordReset'
import { SITE_SETTINGS_DEFAULTS } from '@/lib/api/siteSettings'

const mockGenerateLink = vi.fn()
const mockResetPasswordForEmail = vi.fn()
const mockGetSiteSettings = vi.fn()
const mockSendPasswordResetEmail = vi.fn()

vi.mock('@/lib/api/siteSettings', () => ({
  getSiteSettings: (...args: unknown[]) => mockGetSiteSettings(...args),
  SITE_SETTINGS_DEFAULTS: {
    labelName: 'darkTunes Music Group',
    impressumCompanyName: 'darkTunes Music Group',
    impressumLegalForm: '',
    impressumRepresentative: '',
    impressumAddress: '',
    impressumVatId: '',
    impressumRegisterCourt: '',
    impressumRegisterNumber: '',
    impressumPhone: '',
    impressumEmail: 'info@darktunes.com',
  },
}))

vi.mock('@/lib/email/sendPasswordResetEmail', () => ({
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
}))

function makeAdminClient() {
  return {
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail,
      admin: {
        generateLink: mockGenerateLink,
      },
    },
  }
}

const baseDeps = {
  resendApiKey: 'test-key',
  resendFromEmail: 'noreply@darktunes.com',
  siteUrl: 'https://darktunes.com',
  fetch: vi.fn() as typeof fetch,
}

describe('requestPasswordReset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSiteSettings.mockResolvedValue(SITE_SETTINGS_DEFAULTS)
    mockSendPasswordResetEmail.mockResolvedValue({ success: true })
  })

  it('falls back to Supabase resetPasswordForEmail when Resend is not configured', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null })

    const result = await requestPasswordReset(makeAdminClient() as never, 'user@example.com', {
      ...baseDeps,
      resendApiKey: null,
    })

    expect(result).toEqual({ sent: true, channel: 'supabase_fallback' })
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://darktunes.com/login?type=recovery',
    })
    expect(mockGenerateLink).not.toHaveBeenCalled()
  })

  it('returns silent failure when Supabase fallback errors (unknown email)', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: { message: 'User not found' } })

    const result = await requestPasswordReset(makeAdminClient() as never, 'unknown@example.com', {
      ...baseDeps,
      resendApiKey: null,
    })

    expect(result).toEqual({ sent: false, silent: true, channel: 'supabase_fallback' })
  })

  it('sends branded Resend email when API key is configured', async () => {
    mockGenerateLink.mockResolvedValue({
      data: {
        properties: {
          action_link: 'https://project.supabase.co/auth/v1/verify?token=xyz',
          hashed_token: 'hashed-recovery-token',
        },
      },
      error: null,
    })

    const result = await requestPasswordReset(makeAdminClient() as never, 'user@example.com', baseDeps)

    expect(result).toEqual({ sent: true, channel: 'resend' })
    expect(mockGenerateLink).toHaveBeenCalledWith({
      type: 'recovery',
      email: 'user@example.com',
      options: { redirectTo: 'https://darktunes.com/auth/callback?recovery=1' },
    })
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'user@example.com',
        resetUrl:
          'https://darktunes.com/auth/callback?recovery=1&token_hash=hashed-recovery-token&type=recovery',
      }),
    )
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('returns silent failure when generateLink fails', async () => {
    mockGenerateLink.mockResolvedValue({
      data: null,
      error: { message: 'User not found' },
    })

    const result = await requestPasswordReset(makeAdminClient() as never, 'unknown@example.com', baseDeps)

    expect(result).toEqual({ sent: false, silent: true, channel: 'resend' })
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('falls back to Supabase when Resend send fails', async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: { hashed_token: 'hashed-recovery-token' } },
      error: null,
    })
    mockSendPasswordResetEmail.mockResolvedValue({ success: false, error: 'Resend down' })
    mockResetPasswordForEmail.mockResolvedValue({ error: null })

    const result = await requestPasswordReset(makeAdminClient() as never, 'user@example.com', baseDeps)

    expect(result).toEqual({ sent: true, channel: 'supabase_fallback' })
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://darktunes.com/login?type=recovery',
    })
  })
})