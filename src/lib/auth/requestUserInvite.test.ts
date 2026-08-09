import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requestUserInvite, resendUserInvite, inviteOrResendArtist } from './requestUserInvite'
import { SITE_SETTINGS_DEFAULTS } from '@/lib/api/siteSettings'

const mockGenerateLink = vi.fn()
const mockInviteUserByEmail = vi.fn()
const mockGetUserById = vi.fn()
const mockListUsers = vi.fn()
const mockCreateUser = vi.fn()
const mockUpdateUserById = vi.fn()
const mockGetSiteSettings = vi.fn()
const mockSendInviteEmail = vi.fn()
const mockSyncInvitedUserAccess = vi.fn()
const mockCreateUserInvite = vi.fn()
const mockBuildDurableInviteUrl = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/api/siteSettings', () => ({
  getSiteSettings: (...args: unknown[]) => mockGetSiteSettings(...args),
  SITE_SETTINGS_DEFAULTS: {
    labelName: 'darkTunes Music Group',
    inviteLinkExpiryHours: 168,
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

vi.mock('@/lib/api/userInvites', () => ({
  createUserInvite: (...args: unknown[]) => mockCreateUserInvite(...args),
  buildDurableInviteUrl: (...args: unknown[]) => mockBuildDurableInviteUrl(...args),
}))

function makeMaybeSingle(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  }
}

function makeAdminClient() {
  mockFrom.mockImplementation(() => makeMaybeSingle(null))
  return {
    from: mockFrom,
    auth: {
      admin: {
        generateLink: mockGenerateLink,
        inviteUserByEmail: mockInviteUserByEmail,
        getUserById: mockGetUserById,
        listUsers: mockListUsers,
        createUser: mockCreateUser,
        updateUserById: mockUpdateUserById,
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
    mockGetSiteSettings.mockResolvedValue({
      ...SITE_SETTINGS_DEFAULTS,
      inviteLinkExpiryHours: 168,
    })
    mockSendInviteEmail.mockResolvedValue({ success: true })
    mockSyncInvitedUserAccess.mockResolvedValue(undefined)
    mockCreateUserInvite.mockResolvedValue({
      rawToken: 'raw-token-abc',
      invite: { id: 'invite-1' },
    })
    mockBuildDurableInviteUrl.mockReturnValue(
      'https://darktunes.com/auth/invite?token=raw-token-abc',
    )
    mockListUsers.mockResolvedValue({ data: { users: [] }, error: null })
    mockGetUserById.mockResolvedValue({ data: { user: null }, error: null })
    mockUpdateUserById.mockResolvedValue({ data: { user: {} }, error: null })
    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'new-user-id', email: 'user@example.com', last_sign_in_at: null } },
      error: null,
    })
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
    expect(mockInviteUserByEmail).toHaveBeenCalled()
    expect(mockCreateUserInvite).not.toHaveBeenCalled()
  })

  it('creates durable invite via createUser when Resend is configured', async () => {
    const result = await requestUserInvite(makeAdminClient() as never, baseOptions, baseDeps)

    expect(result.sent).toBe(true)
    expect(result.channel).toBe('resend')
    expect(result.userId).toBe('new-user-id')
    expect(mockCreateUser).toHaveBeenCalled()
    expect(mockCreateUserInvite).toHaveBeenCalled()
    expect(mockSendInviteEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'user@example.com',
        inviteUrl: 'https://darktunes.com/auth/invite?token=raw-token-abc',
        expiresAt: expect.any(Date),
      }),
    )
  })

  it('returns alreadyRegistered when pending user already signed in', async () => {
    const client = makeAdminClient()
    mockFrom.mockImplementation(() => makeMaybeSingle({ id: 'existing-id' }))
    mockGetUserById.mockResolvedValue({
      data: {
        user: {
          id: 'existing-id',
          email: 'user@example.com',
          last_sign_in_at: '2026-01-01T00:00:00Z',
        },
      },
      error: null,
    })

    const result = await requestUserInvite(client as never, baseOptions, baseDeps)
    expect(result.alreadyRegistered).toBe(true)
    expect(result.sent).toBe(false)
  })
})

describe('resendUserInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSiteSettings.mockResolvedValue({
      ...SITE_SETTINGS_DEFAULTS,
      inviteLinkExpiryHours: 48,
    })
    mockSendInviteEmail.mockResolvedValue({ success: true })
    mockSyncInvitedUserAccess.mockResolvedValue(undefined)
    mockCreateUserInvite.mockResolvedValue({
      rawToken: 'new-raw-token',
      invite: { id: 'invite-2' },
    })
    mockBuildDurableInviteUrl.mockReturnValue(
      'https://darktunes.com/auth/invite?token=new-raw-token',
    )
    mockUpdateUserById.mockResolvedValue({ data: { user: {} }, error: null })
  })

  it('issues a new durable invite for users who never signed in', async () => {
    mockGetUserById.mockResolvedValue({
      data: {
        user: {
          id: 'pending-user',
          email: 'pending@example.com',
          last_sign_in_at: null,
          user_metadata: { role: 'editor' },
        },
      },
      error: null,
    })
    mockFrom.mockImplementation(() => makeMaybeSingle({ role: 'editor' }))

    const result = await resendUserInvite(
      makeAdminClient() as never,
      { userId: 'pending-user', grantedBy: 'admin-user-id' },
      baseDeps,
    )

    expect(result.sent).toBe(true)
    expect(result.resent).toBe(true)
    expect(mockCreateUserInvite).toHaveBeenCalled()
  })

  it('refuses resend when user already signed in', async () => {
    mockGetUserById.mockResolvedValue({
      data: {
        user: {
          id: 'active-user',
          email: 'active@example.com',
          last_sign_in_at: '2026-01-01T00:00:00Z',
          user_metadata: {},
        },
      },
      error: null,
    })

    const result = await resendUserInvite(
      makeAdminClient() as never,
      { userId: 'active-user', grantedBy: 'admin-user-id' },
      baseDeps,
    )

    expect(result.sent).toBe(false)
    expect(result.alreadyRegistered).toBe(true)
    expect(mockCreateUserInvite).not.toHaveBeenCalled()
  })
})

describe('inviteOrResendArtist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSiteSettings.mockResolvedValue({
      ...SITE_SETTINGS_DEFAULTS,
      inviteLinkExpiryHours: 168,
    })
    mockSendInviteEmail.mockResolvedValue({ success: true })
    mockSyncInvitedUserAccess.mockResolvedValue(undefined)
    mockCreateUserInvite.mockResolvedValue({
      rawToken: 'artist-token',
      invite: { id: 'invite-a' },
    })
    mockBuildDurableInviteUrl.mockReturnValue(
      'https://darktunes.com/auth/invite?token=artist-token',
    )
    mockUpdateUserById.mockResolvedValue({ data: { user: {} }, error: null })
    mockCreateUser.mockResolvedValue({
      data: { user: { id: 'artist-user', email: 'a@example.com', last_sign_in_at: null } },
      error: null,
    })
  })

  it('resends for linked artist who never signed in', async () => {
    const client = makeAdminClient()
    mockFrom.mockImplementation((table: string) => {
      if (table === 'artists') {
        return makeMaybeSingle({
          id: 'artist-1',
          name: 'Band',
          email: 'a@example.com',
          user_id: 'linked-user',
        })
      }
      return makeMaybeSingle({ role: 'artist' })
    })
    mockGetUserById.mockResolvedValue({
      data: {
        user: {
          id: 'linked-user',
          email: 'a@example.com',
          last_sign_in_at: null,
          user_metadata: { role: 'artist', artist_id: 'artist-1' },
        },
      },
      error: null,
    })

    const result = await inviteOrResendArtist(
      client as never,
      { artistId: 'artist-1', grantedBy: 'admin-1' },
      baseDeps,
    )

    expect(result.sent).toBe(true)
    expect(result.mode).toBe('resend')
    expect(result.resent).toBe(true)
  })

  it('refuses when linked artist already signed in', async () => {
    const client = makeAdminClient()
    mockFrom.mockImplementation(() =>
      makeMaybeSingle({
        id: 'artist-1',
        name: 'Band',
        email: 'a@example.com',
        user_id: 'linked-user',
      }),
    )
    mockGetUserById.mockResolvedValue({
      data: {
        user: {
          id: 'linked-user',
          email: 'a@example.com',
          last_sign_in_at: '2026-01-01T00:00:00Z',
          user_metadata: {},
        },
      },
      error: null,
    })

    const result = await inviteOrResendArtist(
      client as never,
      { artistId: 'artist-1', grantedBy: 'admin-1' },
      baseDeps,
    )

    expect(result.sent).toBe(false)
    expect(result.alreadyRegistered).toBe(true)
  })
})
