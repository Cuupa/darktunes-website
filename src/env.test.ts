/**
 * src/env.test.ts
 *
 * Unit tests for the environment-variable validation module (src/env.ts).
 *
 * Because `process.env` is injected at module-load time, the module is
 * re-imported dynamically after each `vi.stubEnv` call so that the
 * validation runs with the new values.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_URL = 'https://example.supabase.co'
const VALID_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'

async function loadEnvModule() {
  // Bust the module cache so the validation logic re-runs with the current env
  const mod = await import('./env?t=' + Date.now())
  return mod
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('src/env.ts — environment variable validation', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('isDev export', () => {
    it('is true when NODE_ENV is development', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      const { isDev } = await loadEnvModule()
      expect(isDev).toBe(true)
    })

    it('is true when NODE_ENV is test', async () => {
      vi.stubEnv('NODE_ENV', 'test')
      const { isDev } = await loadEnvModule()
      expect(isDev).toBe(true)
    })

    it('is false when NODE_ENV is production', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', VALID_URL)
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', VALID_KEY)
      const { isDev } = await loadEnvModule()
      expect(isDev).toBe(false)
    })
  })

  describe('valid configuration', () => {
    it('returns parsed env when all required vars are present', async () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', VALID_URL)
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', VALID_KEY)
      vi.stubEnv('NODE_ENV', 'production')

      const { env, isSupabaseConfigured } = await loadEnvModule()

      expect(env).not.toBeNull()
      expect(env?.NEXT_PUBLIC_SUPABASE_URL).toBe(VALID_URL)
      expect(env?.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(VALID_KEY)
      expect(isSupabaseConfigured).toBe(true)
    })
  })

  describe('development mode — graceful fallback', () => {
    it('returns null and warns (does not throw) when vars are missing in dev', async () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
      vi.stubEnv('NODE_ENV', 'development')

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { env, isSupabaseConfigured } = await loadEnvModule()

      expect(env).toBeNull()
      expect(isSupabaseConfigured).toBe(false)
      expect(warnSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
    })

    it('returns null and warns when URL is invalid in dev', async () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'not-a-url')
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', VALID_KEY)
      vi.stubEnv('NODE_ENV', 'development')

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { env } = await loadEnvModule()

      expect(env).toBeNull()
      expect(warnSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
    })
  })

  describe('production mode — strict validation', () => {
    it('warns and returns null when vars are missing in production', async () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
      vi.stubEnv('NODE_ENV', 'production')

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { env, isSupabaseConfigured } = await loadEnvModule()

      expect(env).toBeNull()
      expect(isSupabaseConfigured).toBe(false)
      expect(warnSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
    })

    it('warns and returns null when URL is invalid in production', async () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'not-a-url')
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', VALID_KEY)
      vi.stubEnv('NODE_ENV', 'production')

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { env } = await loadEnvModule()

      expect(env).toBeNull()
      expect(warnSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
    })

    it('error message names the missing variable', async () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', VALID_URL)
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
      vi.stubEnv('NODE_ENV', 'production')

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { env } = await loadEnvModule()

      expect(env).toBeNull()
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('NEXT_PUBLIC_SUPABASE_ANON_KEY'))

      warnSpy.mockRestore()
    })
  })
})
