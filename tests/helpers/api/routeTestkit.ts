/**
 * Shared helpers for portal/admin Route Handler unit tests (API SOTA Phase B3).
 *
 * Does not register vi.mock (hoisting) — call factories after mocks are declared.
 */

import { expect } from 'vitest'
import { NextRequest } from 'next/server'
import type { ApiErrorResponse } from '@/lib/errors'

/** Stable UUIDs for multi-artist / membership scenarios. */
export const TEST_ARTIST_ID = '123e4567-e89b-12d3-a456-426614174000'
export const TEST_ARTIST_B_ID = '223e4567-e89b-12d3-a456-426614174001'
export const TEST_USER_ID = 'c39b3097-cb23-472c-9146-c42652395fed'
export const TEST_USER_B_ID = 'd39b3097-cb23-472c-9146-c42652395fed'

export type JsonRequestInit = {
  method?: string
  body?: unknown
  /** When set, sends Authorization: Bearer <token>. Omit for unauthenticated. */
  bearer?: string | null
  searchParams?: Record<string, string>
}

/**
 * Build a NextRequest against a local API path with optional JSON body + Bearer.
 */
export function jsonRequest(path: string, init: JsonRequestInit = {}): NextRequest {
  const url = new URL(path, 'http://localhost')
  if (init.searchParams) {
    for (const [k, v] of Object.entries(init.searchParams)) {
      url.searchParams.set(k, v)
    }
  }

  const headers = new Headers()
  if (init.bearer) {
    headers.set('authorization', `Bearer ${init.bearer}`)
  }
  if (init.body !== undefined) {
    headers.set('content-type', 'application/json')
  }

  return new NextRequest(url, {
    method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
}

export async function readJson<T = unknown>(
  res: Response,
): Promise<{ status: number; body: T }> {
  const body = (await res.json()) as T
  return { status: res.status, body }
}

/** Assert HTTP status and return parsed JSON body. */
export async function expectStatus<T = unknown>(
  res: Response,
  status: number,
): Promise<T> {
  const parsed = await readJson<T>(res)
  expect(parsed.status, JSON.stringify(parsed.body)).toBe(status)
  return parsed.body
}

/** Golden: unauthenticated → 401 with standard error shape. */
export async function expectUnauthorized(res: Response): Promise<ApiErrorResponse> {
  const body = await expectStatus<ApiErrorResponse>(res, 401)
  expect(body).toMatchObject({ error: expect.any(String), status: 401 })
  return body
}

/** Golden: wrong tenant / no membership → 403. */
export async function expectForbidden(res: Response): Promise<ApiErrorResponse> {
  const body = await expectStatus<ApiErrorResponse>(res, 403)
  expect(body).toMatchObject({ error: expect.any(String), status: 403 })
  return body
}

/** Golden: success 2xx. */
export async function expectOk<T = unknown>(
  res: Response,
  status = 200,
): Promise<T> {
  return expectStatus<T>(res, status)
}

/**
 * Throw ApiError from the same module graph as the route under test.
 * Required after `vi.resetModules()` so `instanceof ApiError` in withErrorHandler works.
 */
export async function rejectApiError(status: number, message: string): Promise<never> {
  const { ApiError } = await import('@/lib/errors')
  throw new ApiError(status, message)
}

/**
 * Minimal portal membership context for withPortalMembership / portalMemberWrite mocks.
 */
export function makePortalMembershipContext(overrides?: {
  artistId?: string
  userId?: string
  userDb?: unknown
  serviceDb?: unknown
}) {
  const artistId = overrides?.artistId ?? TEST_ARTIST_ID
  const userId = overrides?.userId ?? TEST_USER_ID
  return {
    token: 'test-token',
    user: { id: userId },
    artist: { id: artistId, slug: 'test-artist', name: 'Test Artist' },
    userDb: overrides?.userDb ?? { kind: 'user' },
    serviceDb: overrides?.serviceDb ?? { kind: 'service' },
  }
}

type MaybeSingleResult = { data: unknown; error: null }

/**
 * Chainable filter builder: .eq().eq().maybeSingle()
 */
function eqChain(terminal: () => Promise<MaybeSingleResult>) {
  const chain = {
    eq: () => chain,
    maybeSingle: terminal,
    single: terminal,
  }
  return chain
}

/**
 * Cookie-session Supabase mock for portal messages (createServerSupabaseClient path).
 */
export function makeCookieSessionSupabase(options: {
  userId?: string | null
  /** false → no user (401) */
  authenticated?: boolean
  /** artist_members.maybeSingle data; null = not a member (403) */
  membership?: { id: string } | null
  /** artists.maybeSingle for recipient existence */
  targetArtist?: { id: string } | null
}) {
  const authenticated = options.authenticated !== false
  const userId = options.userId ?? TEST_USER_ID
  const membership =
    options.membership === undefined ? { id: 'mem-1' } : options.membership
  const targetArtist =
    options.targetArtist === undefined
      ? { id: TEST_ARTIST_B_ID }
      : options.targetArtist

  return {
    auth: {
      getUser: async () =>
        authenticated && userId
          ? { data: { user: { id: userId } }, error: null }
          : {
              data: { user: null },
              error: { message: 'Auth session missing' },
            },
    },
    from: (table: string) => {
      if (table === 'artist_members') {
        return {
          select: () =>
            eqChain(async () => ({ data: membership, error: null })),
        }
      }
      if (table === 'artists') {
        return {
          select: () =>
            eqChain(async () => ({ data: targetArtist, error: null })),
        }
      }
      if (table === 'users') {
        return {
          select: () => ({
            in: async () => ({ data: [{ id: 'admin-1' }], error: null }),
          }),
        }
      }
      if (table === 'editor_notifications') {
        return {
          insert: async () => ({ error: null }),
        }
      }
      return {
        select: () =>
          eqChain(async () => ({ data: null, error: null })),
        insert: async () => ({ error: null }),
      }
    },
  }
}

/**
 * Service-role client: artists.update().eq() succeeds.
 */
export function makeServiceRoleArtistUpdateClient() {
  return {
    from: (table: string) => {
      if (table === 'artists') {
        return {
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        }
      }
      return {
        select: () =>
          eqChain(async () => ({ data: null, error: null })),
      }
    },
  }
}
