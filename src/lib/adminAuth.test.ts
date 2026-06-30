/**
 * src/lib/adminAuth.test.ts
 *
 * Unit tests for the shared admin/editor auth helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractBearerToken, verifyAdminOrEditor, verifyAdmin, verifyPermission } from './adminAuth'
import { ApiError } from './errors'
import type { EffectiveAccess } from '@/lib/rbac/types'

const resolveEffectiveAccessMock = vi.fn()

vi.mock('@/lib/rbac/resolveAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rbac/resolveAccess')>()
  return {
    ...actual,
    resolveEffectiveAccess: (...args: unknown[]) => resolveEffectiveAccessMock(...args),
  }
})

function makeAccess(overrides: Partial<EffectiveAccess> = {}): EffectiveAccess {
  return {
    primaryRole: 'editor',
    allRoles: ['editor'],
    permissions: new Set<string>(),
    capabilities: new Set(),
    customRoleNames: [],
    isAdmin: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// extractBearerToken
// ---------------------------------------------------------------------------

describe('extractBearerToken', () => {
  it('returns the token when header is valid', () => {
    expect(extractBearerToken('Bearer abc123')).toBe('abc123')
  })

  it('throws ApiError(401) when header is null', () => {
    expect(() => extractBearerToken(null)).toThrow(ApiError)
    try {
      extractBearerToken(null)
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).status).toBe(401)
    }
  })

  it('throws ApiError(401) when header does not start with Bearer', () => {
    expect(() => extractBearerToken('Basic abc123')).toThrow(ApiError)
    try {
      extractBearerToken('Basic abc123')
    } catch (err) {
      expect((err as ApiError).status).toBe(401)
    }
  })

  it('throws ApiError(401) when header is empty string', () => {
    expect(() => extractBearerToken('')).toThrow(ApiError)
  })
})

// ---------------------------------------------------------------------------
// verifyAdminOrEditor
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockMaybeSingle = vi.fn()

const mockFrom = vi.fn().mockReturnValue({
  select: mockSelect.mockReturnValue({
    eq: mockEq.mockReturnValue({
      maybeSingle: mockMaybeSingle,
    }),
  }),
})

const mockAuthAdmin = {
  getUser: mockGetUser,
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: mockAuthAdmin,
    from: mockFrom,
  })),
}))

describe('verifyAdminOrEditor', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')

    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    })
  })

  it('returns userId when user has admin role', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockMaybeSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })

    const userId = await verifyAdminOrEditor('valid-token')
    expect(userId).toBe('user-1')
  })

  it('returns userId when user has editor role', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    mockMaybeSingle.mockResolvedValue({ data: { role: 'editor' }, error: null })

    const userId = await verifyAdminOrEditor('valid-token')
    expect(userId).toBe('user-2')
  })

  it('throws ApiError(401) when getUser returns an error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid token') })

    await expect(verifyAdminOrEditor('bad-token')).rejects.toThrow(ApiError)
    await expect(verifyAdminOrEditor('bad-token')).rejects.toMatchObject({ status: 401 })
  })

  it('throws ApiError(401) when user is null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    await expect(verifyAdminOrEditor('bad-token')).rejects.toMatchObject({ status: 401 })
  })

  it('throws ApiError(403) when user has journalist role', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-3' } }, error: null })
    mockMaybeSingle.mockResolvedValue({ data: { role: 'journalist' }, error: null })

    await expect(verifyAdminOrEditor('token')).rejects.toMatchObject({ status: 403 })
  })

  it('throws ApiError(403) when user has user role', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-4' } }, error: null })
    mockMaybeSingle.mockResolvedValue({ data: { role: 'user' }, error: null })

    await expect(verifyAdminOrEditor('token')).rejects.toMatchObject({ status: 403 })
  })

  it('throws ApiError(500) when env vars are missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

    await expect(verifyAdminOrEditor('token')).rejects.toMatchObject({ status: 500 })
  })
})

// ---------------------------------------------------------------------------
// verifyAdmin
// ---------------------------------------------------------------------------

describe('verifyAdmin', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')

    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    })
  })

  it('returns userId when user has admin role', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    mockMaybeSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })

    const userId = await verifyAdmin('valid-token')
    expect(userId).toBe('admin-1')
  })

  it('throws ApiError(403) when user has editor role', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'editor-1' } }, error: null })
    mockMaybeSingle.mockResolvedValue({ data: { role: 'editor' }, error: null })

    await expect(verifyAdmin('token')).rejects.toMatchObject({ status: 403 })
  })

  it('throws ApiError(401) when user is null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    await expect(verifyAdmin('bad-token')).rejects.toMatchObject({ status: 401 })
  })

  it('throws ApiError(500) when env vars are missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

    await expect(verifyAdmin('token')).rejects.toMatchObject({ status: 500 })
  })
})

// ---------------------------------------------------------------------------
// verifyPermission
// ---------------------------------------------------------------------------

describe('verifyPermission', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    resolveEffectiveAccessMock.mockReset()
  })

  it('returns userId for admin without checking role_permissions', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    resolveEffectiveAccessMock.mockResolvedValue(makeAccess({ primaryRole: 'admin', isAdmin: true }))

    const userId = await verifyPermission('valid-token', 'can_manage_artists')
    expect(userId).toBe('admin-1')
    expect(resolveEffectiveAccessMock).toHaveBeenCalledTimes(1)
  })

  it('returns userId when editor has the required permission', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'editor-1' } }, error: null })
    resolveEffectiveAccessMock.mockResolvedValue(
      makeAccess({ permissions: new Set(['can_manage_releases']) }),
    )

    const userId = await verifyPermission('valid-token', 'can_manage_releases')
    expect(userId).toBe('editor-1')
  })

  it('throws ApiError(403) when user lacks the required permission', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'editor-1' } }, error: null })
    resolveEffectiveAccessMock.mockResolvedValue(makeAccess())

    await expect(verifyPermission('token', 'can_manage_artists')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('throws ApiError(403) when journalist has no permissions', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'journalist-1' } }, error: null })
    resolveEffectiveAccessMock.mockResolvedValue(
      makeAccess({ primaryRole: 'journalist', allRoles: ['journalist'] }),
    )

    await expect(verifyPermission('token', 'can_publish_news')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('throws ApiError(401) when user is null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    await expect(verifyPermission('bad-token', 'can_view_admin_panel')).rejects.toMatchObject({
      status: 401,
    })
  })

  it('throws ApiError(500) when env vars are missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

    await expect(verifyPermission('token', 'can_edit_news')).rejects.toMatchObject({ status: 500 })
  })

  it('throws ApiError(500) when role_permissions query fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'editor-1' } }, error: null })
    resolveEffectiveAccessMock.mockRejectedValue(new Error('DB error'))

    await expect(verifyPermission('token', 'can_manage_videos')).rejects.toMatchObject({
      status: 500,
    })
  })
})
