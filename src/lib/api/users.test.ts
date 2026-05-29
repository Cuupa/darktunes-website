/**
 * src/lib/api/users.test.ts
 *
 * Unit tests for the admin user-management DAL (src/lib/api/users.ts).
 */

import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  listUsersWithProfiles,
  updateUserRole,
  banUser,
  deleteUser,
  linkArtistToUser,
  unlinkArtistFromUser,
} from './users'

type DbClient = SupabaseClient<Database>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

function makeMockDb(data: unknown = null, error: unknown = null): DbClient {
  return { from: vi.fn().mockReturnValue(makeBuilder(data, error)) } as unknown as DbClient
}

/** Build an admin client mock that supports both .auth.admin.* and .from() */
function makeAdminClient(opts: {
  listUsersData?: unknown
  listUsersError?: unknown
  profilesData?: unknown
  profilesError?: unknown
  artistsData?: unknown
  artistsError?: unknown
  updateUserError?: unknown
  deleteUserError?: unknown
  fromData?: unknown
  fromError?: unknown
}): DbClient {
  const {
    listUsersData = [],
    listUsersError = null,
    profilesData = [],
    profilesError = null,
    artistsData = [],
    artistsError = null,
    updateUserError = null,
    deleteUserError = null,
    fromData = null,
    fromError = null,
  } = opts

  // Each call to .from() gets a fresh builder with the appropriate data
  let callCount = 0
  const responses = [
    { data: profilesData, error: profilesError },
    { data: artistsData, error: artistsError },
    { data: fromData, error: fromError },
  ]

  const from = vi.fn(() => {
    const resp = responses[callCount] ?? { data: fromData, error: fromError }
    callCount++
    return makeBuilder(resp.data, resp.error)
  })

  return {
    from,
    auth: {
      admin: {
        listUsers: vi.fn(async () => ({
          data: { users: listUsersData },
          error: listUsersError,
        })),
        updateUserById: vi.fn(async () => ({ error: updateUserError })),
        deleteUser: vi.fn(async () => ({ error: deleteUserError })),
      },
    },
  } as unknown as DbClient
}

// ---------------------------------------------------------------------------
// listUsersWithProfiles
// ---------------------------------------------------------------------------

describe('listUsersWithProfiles', () => {
  it('returns merged user list', async () => {
    const client = makeAdminClient({
      listUsersData: [
        {
          id: 'user-1',
          email: 'admin@test.com',
          created_at: '2024-01-01T00:00:00Z',
          last_sign_in_at: '2024-05-01T00:00:00Z',
          banned_until: null,
        },
      ],
      profilesData: [{ id: 'user-1', role: 'admin' }],
      artistsData: [],
    })

    const users = await listUsersWithProfiles(client)

    expect(users).toHaveLength(1)
    expect(users[0].email).toBe('admin@test.com')
    expect(users[0].role).toBe('admin')
    expect(users[0].linked_artist).toBeNull()
  })

  it('merges linked artist data', async () => {
    const client = makeAdminClient({
      listUsersData: [
        {
          id: 'user-1',
          email: 'band@test.com',
          created_at: '2024-01-01T00:00:00Z',
          last_sign_in_at: null,
          banned_until: null,
        },
      ],
      profilesData: [{ id: 'user-1', role: 'user' }],
      artistsData: [{ id: 'artist-1', name: 'Dark Band', slug: 'dark-band', user_id: 'user-1' }],
    })

    const users = await listUsersWithProfiles(client)

    expect(users[0].linked_artist).toEqual({
      id: 'artist-1',
      name: 'Dark Band',
      slug: 'dark-band',
    })
  })

  it('falls back to "user" role when profile is missing', async () => {
    const client = makeAdminClient({
      listUsersData: [
        {
          id: 'user-orphan',
          email: 'orphan@test.com',
          created_at: '2024-01-01T00:00:00Z',
          last_sign_in_at: null,
          banned_until: null,
        },
      ],
      profilesData: [],
      artistsData: [],
    })

    const users = await listUsersWithProfiles(client)
    expect(users[0].role).toBe('user')
  })

  it('throws when listUsers fails', async () => {
    const client = makeAdminClient({
      listUsersError: { message: 'Auth Admin API unavailable' },
    })

    await expect(listUsersWithProfiles(client)).rejects.toThrow('Auth Admin API unavailable')
  })

  it('throws when profiles query fails', async () => {
    const client = makeAdminClient({
      listUsersData: [],
      profilesError: { message: 'DB error' },
    })

    await expect(listUsersWithProfiles(client)).rejects.toThrow('DB error')
  })
})

// ---------------------------------------------------------------------------
// updateUserRole
// ---------------------------------------------------------------------------

describe('updateUserRole', () => {
  it('resolves without error on success', async () => {
    const db = makeMockDb([{ id: 'user-1' }], null)
    await expect(updateUserRole(db, 'user-1', 'editor')).resolves.toBeUndefined()
  })

  it('throws when DB returns an error', async () => {
    const db = makeMockDb(null, { message: 'Update failed' })
    await expect(updateUserRole(db, 'user-1', 'editor')).rejects.toThrow('Update failed')
  })

  it('calls update on the profiles table', async () => {
    const builder = makeBuilder([{ id: 'user-1' }], null)
    const db = { from: vi.fn().mockReturnValue(builder) } as unknown as DbClient
    await updateUserRole(db, 'user-1', 'journalist')
    expect(db.from).toHaveBeenCalledWith('profiles')
    expect(builder.update).toHaveBeenCalledWith({ role: 'journalist' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'user-1')
  })
})

// ---------------------------------------------------------------------------
// banUser
// ---------------------------------------------------------------------------

describe('banUser', () => {
  it('bans a user by setting a long ban_duration', async () => {
    const client = makeAdminClient({ updateUserError: null })
    await expect(banUser(client, 'user-1', true)).resolves.toBeUndefined()
    const adminApi = (client.auth.admin as unknown) as { updateUserById: ReturnType<typeof vi.fn> }
    expect(adminApi.updateUserById)
      .toHaveBeenCalledWith('user-1', { ban_duration: '876000h' })
  })

  it('unbans a user by passing "none"', async () => {
    const client = makeAdminClient({ updateUserError: null })
    await banUser(client, 'user-1', false)
    const adminApi = (client.auth.admin as unknown) as { updateUserById: ReturnType<typeof vi.fn> }
    expect(adminApi.updateUserById)
      .toHaveBeenCalledWith('user-1', { ban_duration: 'none' })
  })

  it('throws on Auth Admin API error', async () => {
    const client = makeAdminClient({ updateUserError: { message: 'Ban failed' } })
    await expect(banUser(client, 'user-1', true)).rejects.toThrow('Ban failed')
  })
})

// ---------------------------------------------------------------------------
// deleteUser
// ---------------------------------------------------------------------------

describe('deleteUser', () => {
  it('resolves without error on success', async () => {
    const client = makeAdminClient({ deleteUserError: null })
    await expect(deleteUser(client, 'user-1')).resolves.toBeUndefined()
  })

  it('throws on Auth Admin API error', async () => {
    const client = makeAdminClient({ deleteUserError: { message: 'Delete denied' } })
    await expect(deleteUser(client, 'user-1')).rejects.toThrow('Delete denied')
  })
})

// ---------------------------------------------------------------------------
// linkArtistToUser
// ---------------------------------------------------------------------------

describe('linkArtistToUser', () => {
  it('resolves without error on success', async () => {
    const db = makeMockDb(null, null)
    await expect(linkArtistToUser(db, 'artist-1', 'user-1')).resolves.toBeUndefined()
  })

  it('throws on DB error', async () => {
    const db = makeMockDb(null, { message: 'Link failed' })
    await expect(linkArtistToUser(db, 'artist-1', 'user-1')).rejects.toThrow('Link failed')
  })

  it('calls update on artists table with correct args', async () => {
    const builder = makeBuilder(null, null)
    const db = { from: vi.fn().mockReturnValue(builder) } as unknown as DbClient
    await linkArtistToUser(db, 'artist-1', 'user-1')
    expect(db.from).toHaveBeenCalledWith('artists')
    expect(builder.update).toHaveBeenCalledWith({ user_id: 'user-1' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'artist-1')
    expect(builder.is).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// unlinkArtistFromUser
// ---------------------------------------------------------------------------

describe('unlinkArtistFromUser', () => {
  it('resolves without error on success', async () => {
    const db = makeMockDb(null, null)
    await expect(unlinkArtistFromUser(db, 'artist-1')).resolves.toBeUndefined()
  })

  it('throws on DB error', async () => {
    const db = makeMockDb(null, { message: 'Unlink failed' })
    await expect(unlinkArtistFromUser(db, 'artist-1')).rejects.toThrow('Unlink failed')
  })

  it('calls update on artists table clearing user_id', async () => {
    const builder = makeBuilder(null, null)
    const db = { from: vi.fn().mockReturnValue(builder) } as unknown as DbClient
    await unlinkArtistFromUser(db, 'artist-1')
    expect(db.from).toHaveBeenCalledWith('artists')
    expect(builder.update).toHaveBeenCalledWith({ user_id: null })
    expect(builder.eq).toHaveBeenCalledWith('id', 'artist-1')
  })
})
