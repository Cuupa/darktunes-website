import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requestUserInvite } from './requestUserInvite'
import { SITE_SETTINGS_DEFAULTS } from '@/lib/api/siteSettings'

const mockGenerateLink = vi.fn()
const mockInviteUserByEmail = vi.fn()
const mockGetSiteSettings = vi.fn()
const mockSendInviteEmail = vi.fn()
const mockSyncInvitedUserAccess = vi.fn()

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

vi.mock('@/lib/email/sendInviteEmail', () => ({
  sendInviteEmail: (...args: unknown[]) => mockSendInviteEmail(...args),
}))

vi.mock('@/lib/api/users', () => ({
  syncInvitedUserAccess: (...args: unknown[]) => mockSyncInvitedUserAccess(...args),
}))

function makeAdminClient() {
  return {
    auth: {
      admin: {
        generateLink: mockGenerateLink,
        inviteUserByEmail: mockInviteUserByEmail,
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

const baseOptions = {
  email: 'user@example.com',
  role: 'editor' as const,
  grantedBy: 'admin-user-id',
}

describe('requestUserInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSiteSettings.mockResolvedValue(SITE_SETTINGS_DEFAULTS)
    mockSendInviteEmail.mockResolvedValue({ success: true })
    mockSyncInvitedUserAccess.mockResolvedValue(undefined)
  })

  it('falls back to Supabase inviteUserByEmail when Resend is not configured', async () => {
    mockInviteUserByEmail.mockResolvedValue({
      data: { user: { id: 'new-user-id' } },
      error: null,
    })

    const result = await requestUserInvite(makeAdminClient() as never, baseOptions, {
      ...baseDeps,
      resendApiKey: null,
    })

    expect(result).toEqual({
      sent: true,
      channel: 'supabase_fallback',
      userId: 'new-user-id',
    })
    expect(mockInviteUserByEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'https://darktunes.com/login',
      data: { role: 'editor' },
    })
    expect(mockSyncInvitedUserAccess).toHaveBeenCalledWith(
      expect.anything(),
      'new-user-id',
      'editor',
      'admin-user-id',
      undefined,
    )
    expect(mockGenerateLink).not.toHaveBeenCalled()
  })

  it('returns alreadyRegistered when Supabase reports duplicate email', async () => {
    mockInviteUserByEmail.mockResolvedValue({
      data: null,
      error: { message: 'User already registered' },
    })

    const result = await requestUserInvite(makeAdminClient() as never, baseOptions, {
      ...baseDeps,
      resendApiKey: null,
    })

    expect(result).toEqual({
      sent: false,
      alreadyRegistered: true,
      channel: 'supabase_fallback',
    })
  })

  it('sends branded Resend invite when API key is configured', async () => {
    mockGenerateLink.mockResolvedValue({
      data: {
        user: { id: 'new-user-id' },
        properties: { hashed_token: 'hashed-invite-token' },
      },
      error: null,
    })

    const result = await requestUserInvite(makeAdminClient() as never, baseOptions, baseDeps)

    expect(result).toEqual({ sent: true, channel: 'resend', userId: 'new-user-id' })
    expect(mockGenerateLink).toHaveBeenCalledWith({
      type: 'invite',
      email: 'user@example.com',
      options: {
        redirectTo: 'https://darktunes.com/auth/callback?invite=1',
        data: { role: 'editor' },
      },
    })
    expect(mockSendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'user@example.com',
        inviteUrl:
          'https://darktunes.com/auth/callback?invite=1&token_hash=hashed-invite-token&type=invite',
        role: 'editor',
      }),
    )
    expect(mockInviteUserByEmail).not.toHaveBeenCalled()
  })

  it('uses portal redirect and artist metadata for artist invites', async () => {
    mockGenerateLink.mockResolvedValue({
      data: {
        user: { id: 'artist-user-id' },
        properties: { hashed_token: 'hashed-invite-token' },
      },
      error: null,
    })

    const result = await requestUserInvite(
      makeAdminClient() as never,
      {
        ...baseOptions,
        email: 'artist@example.com',
        role: 'artist',
        portal: true,
        artistId: 'artist-uuid',
      },
      baseDeps,
    )

    expect(result.sent).toBe(true)
    expect(mockGenerateLink).toHaveBeenCalledWith({
      type: 'invite',
      email: 'artist@example.com',
      options: {
        redirectTo: 'https://darktunes.com/auth/callback?invite=1&portal=1',
        data: { role: 'artist', artist_id: 'artist-uuid' },
      },
    })
    expect(mockSendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        inviteUrl:
          'https://darktunes.com/auth/callback?invite=1&token_hash=hashed-invite-token&type=invite&portal=1',
      }),
    )
    expect(mockSyncInvitedUserAccess).toHaveBeenCalledWith(
      expect.anything(),
      'artist-user-id',
      'artist',
      'admin-user-id',
      'artist-uuid',
    )
  })

  it('returns failure when Resend send fails after generateLink created the user', async () => {
    mockGenerateLink.mockResolvedValue({
      data: {
        user: { id: 'new-user-id' },
        properties: { hashed_token: 'hashed-invite-token' },
      },
      error: null,
    })
    mockSendInviteEmail.mockResolvedValue({ success: false, error: 'Resend down' })

    const result = await requestUserInvite(makeAdminClient() as never, baseOptions, baseDeps)

    expect(result).toEqual({
      sent: false,
      channel: 'resend',
      userId: 'new-user-id',
      error: 'Resend down',
    })
    expect(mockInviteUserByEmail).not.toHaveBeenCalled()
  })
})