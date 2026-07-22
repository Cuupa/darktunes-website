import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isLikelyRlsOrPermissionError,
  isPortalUserJwtWritesEnabled,
  portalWriteWithCanary,
  type PortalDb,
} from './portalWriteClient'

describe('isPortalUserJwtWritesEnabled', () => {
  it('defaults to false', () => {
    expect(isPortalUserJwtWritesEnabled({})).toBe(false)
  })

  it.each(['1', 'true', 'TRUE', 'yes', 'on'])('enables for %s', (value) => {
    expect(isPortalUserJwtWritesEnabled({ PORTAL_WRITES_USE_USER_JWT: value })).toBe(true)
  })

  it.each(['0', 'false', 'no', '', 'maybe'])('disables for %s', (value) => {
    expect(isPortalUserJwtWritesEnabled({ PORTAL_WRITES_USE_USER_JWT: value })).toBe(false)
  })
})

describe('isLikelyRlsOrPermissionError', () => {
  it('detects RLS messages', () => {
    expect(
      isLikelyRlsOrPermissionError(new Error('new row violates row-level security policy')),
    ).toBe(true)
  })

  it('detects permission denied', () => {
    expect(isLikelyRlsOrPermissionError(new Error('permission denied for table artists'))).toBe(
      true,
    )
  })

  it('detects postgres 42501 code', () => {
    expect(isLikelyRlsOrPermissionError({ code: '42501', message: 'denied' })).toBe(true)
  })

  it('does not treat FK or validation as RLS', () => {
    expect(isLikelyRlsOrPermissionError(new Error('insert or update on table violates foreign key'))).toBe(
      false,
    )
    expect(isLikelyRlsOrPermissionError(new Error('duplicate key value'))).toBe(false)
  })
})

describe('portalWriteWithCanary', () => {
  const userDb = { name: 'user' } as unknown as PortalDb
  const serviceDb = { name: 'service' } as unknown as PortalDb
  const context = {
    route: 'PUT /api/portal/profile',
    table: 'artist_epks',
    operation: 'upsert',
    artistId: 'artist-1',
    userId: 'user-1',
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses service role when canary is off', async () => {
    const write = vi.fn(async (db: PortalDb) => {
      expect(db).toBe(serviceDb)
      return 'ok'
    })

    const result = await portalWriteWithCanary({
      userDb,
      serviceDb,
      context,
      write,
      useUserJwt: false,
    })

    expect(result).toEqual({ value: 'ok', via: 'service_role', fellBack: false })
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('uses user JWT when canary is on and write succeeds', async () => {
    const write = vi.fn(async (db: PortalDb) => {
      expect(db).toBe(userDb)
      return 42
    })

    const result = await portalWriteWithCanary({
      userDb,
      serviceDb,
      context,
      write,
      useUserJwt: true,
    })

    expect(result).toEqual({ value: 42, via: 'user_jwt', fellBack: false })
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('falls back to service role on RLS failure and logs', async () => {
    const write = vi
      .fn()
      .mockRejectedValueOnce(new Error('new row violates row-level security policy'))
      .mockResolvedValueOnce('saved')
    const logFallback = vi.fn().mockResolvedValue(undefined)

    const result = await portalWriteWithCanary({
      userDb,
      serviceDb,
      context,
      write,
      useUserJwt: true,
      logFallback,
    })

    expect(result).toEqual({ value: 'saved', via: 'service_role', fellBack: true })
    expect(write).toHaveBeenNthCalledWith(1, userDb)
    expect(write).toHaveBeenNthCalledWith(2, serviceDb)
    expect(logFallback).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'portal_rls_fallback',
        level: 'warn',
        userId: 'user-1',
      }),
    )
  })

  it('does not fall back on non-RLS errors', async () => {
    const write = vi.fn().mockRejectedValue(new Error('duplicate key value'))

    await expect(
      portalWriteWithCanary({
        userDb,
        serviceDb,
        context,
        write,
        useUserJwt: true,
      }),
    ).rejects.toThrow('duplicate key value')

    expect(write).toHaveBeenCalledTimes(1)
  })
})
