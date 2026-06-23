import { describe, expect, it, vi } from 'vitest'
import { listEpkShareLinks } from './epkShareLinks'

function createMockDb(data: unknown[] = [], error: { message: string } | null = null) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: (resolve: (value: { data: unknown[]; error: typeof error }) => void) =>
      Promise.resolve({ data, error }).then(resolve),
    catch: (reject: (reason: unknown) => void) =>
      Promise.resolve({ data, error }).catch(reject),
    finally: (cb: () => void) => Promise.resolve({ data, error }).finally(cb),
  }

  return {
    from: vi.fn(() => builder),
    builder,
  }
}

describe('epkShareLinks', () => {
  it('lists share links for an artist', async () => {
    const mock = createMockDb([
      {
        id: 'link-1',
        artist_id: 'artist-1',
        token: 'abc123',
        password_hash: null,
        expires_at: null,
        label: 'Bookers',
        created_by: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
        revoked_at: null,
      },
    ])

    const links = await listEpkShareLinks(mock as never, 'artist-1')
    expect(links).toHaveLength(1)
    expect(links[0].token).toBe('abc123')
    expect(links[0].hasPassword).toBe(false)
  })

  it('excludes expired share links from the list', async () => {
    const mock = createMockDb([
      {
        id: 'link-active',
        artist_id: 'artist-1',
        token: 'active',
        password_hash: null,
        expires_at: null,
        label: 'Active',
        created_by: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
        revoked_at: null,
      },
      {
        id: 'link-expired',
        artist_id: 'artist-1',
        token: 'expired',
        password_hash: null,
        expires_at: '2020-01-01T00:00:00Z',
        label: 'Expired',
        created_by: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
        revoked_at: null,
      },
    ])

    const links = await listEpkShareLinks(mock as never, 'artist-1')
    expect(links).toHaveLength(1)
    expect(links[0].id).toBe('link-active')
  })
})