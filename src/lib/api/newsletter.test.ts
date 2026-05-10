import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createPendingSubscriber, verifySubscriberToken } from './newsletter'

type DbClient = SupabaseClient<Database>
type SubscriberRow = Database['public']['Tables']['newsletter_subscribers']['Row']

// ---------------------------------------------------------------------------
// Mock builder — matches the Supabase mock pattern documented in AGENTS.md
// ---------------------------------------------------------------------------

function makeBuilder(data: unknown = null, error: unknown = null) {
  const result = { data, error }
  const p = Promise.resolve(result)
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
}

function makeMockDb(data: unknown = null, error: unknown = null): DbClient {
  return { from: vi.fn().mockReturnValue(makeBuilder(data, error)) } as unknown as DbClient
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockPendingRow: SubscriberRow = {
  id: 'sub-uuid-1',
  email: 'test@example.com',
  name: 'Test User',
  source: 'website',
  status: 'pending',
  verification_token: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  subscribed_at: '2026-05-10T12:00:00Z',
}

const mockSubscribedRow: SubscriberRow = {
  ...mockPendingRow,
  status: 'subscribed',
  verification_token: null,
}

// ---------------------------------------------------------------------------
// createPendingSubscriber
// ---------------------------------------------------------------------------

describe('createPendingSubscriber', () => {
  it('inserts and returns mapped domain object', async () => {
    const db = makeMockDb(mockPendingRow)
    const result = await createPendingSubscriber(
      db,
      'test@example.com',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      'Test User',
    )
    expect(result.email).toBe('test@example.com')
    expect(result.name).toBe('Test User')
    expect(result.status).toBe('pending')
    expect(result.verificationToken).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
  })

  it('maps null name to undefined', async () => {
    const rowWithoutName: SubscriberRow = { ...mockPendingRow, name: null }
    const db = makeMockDb(rowWithoutName)
    const result = await createPendingSubscriber(
      db,
      'test@example.com',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    )
    expect(result.name).toBeUndefined()
  })

  it('maps null verification_token to undefined', async () => {
    const row: SubscriberRow = { ...mockPendingRow, verification_token: null }
    const db = makeMockDb(row)
    const result = await createPendingSubscriber(
      db,
      'test@example.com',
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    )
    expect(result.verificationToken).toBeUndefined()
  })

  it('throws on database error (e.g. unique constraint violation)', async () => {
    const db = makeMockDb(null, {
      message: 'duplicate key value violates unique constraint "newsletter_subscribers_email_key"',
      code: '23505',
    })
    await expect(
      createPendingSubscriber(db, 'dupe@example.com', 'token-uuid'),
    ).rejects.toThrow('duplicate key value')
  })

  it('throws when no row is returned', async () => {
    const db = makeMockDb(null, null)
    await expect(
      createPendingSubscriber(db, 'test@example.com', 'token-uuid'),
    ).rejects.toThrow('No data returned from createPendingSubscriber')
  })
})

// ---------------------------------------------------------------------------
// verifySubscriberToken
// ---------------------------------------------------------------------------

describe('verifySubscriberToken', () => {
  it('returns the subscriber with subscribed status on valid token', async () => {
    const db = makeMockDb(mockSubscribedRow)
    const result = await verifySubscriberToken(db, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(result).not.toBeNull()
    expect(result?.status).toBe('subscribed')
    expect(result?.email).toBe('test@example.com')
    expect(result?.verificationToken).toBeUndefined()
  })

  it('returns null when token is not found (PGRST116)', async () => {
    const db = makeMockDb(null, { code: 'PGRST116', message: 'No rows found' })
    const result = await verifySubscriberToken(db, 'unknown-token')
    expect(result).toBeNull()
  })

  it('throws on unexpected database errors', async () => {
    const db = makeMockDb(null, { code: '42P01', message: 'relation does not exist' })
    await expect(
      verifySubscriberToken(db, 'some-token'),
    ).rejects.toThrow('relation does not exist')
  })

  it('returns null when db returns no row and no error', async () => {
    const db = makeMockDb(null, null)
    const result = await verifySubscriberToken(db, 'some-token')
    expect(result).toBeNull()
  })
})
