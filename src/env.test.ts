/**
 * src/env.test.ts
 *
 * Unit tests for the environment-variable validation module (src/env.ts).
 *
 * Because `import.meta.env` is injected by Vite at module-load time, the
 * module is re-imported dynamically after each `vi.stubEnv` call so that the
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
    it('is true when MODE is development', async () => {
      vi.stubEnv('MODE', 'development')
      const { isDev } = await loadEnvModule()
      expect(isDev).toBe(true)
    })

    it('is true when MODE is preview', async () => {
      vi.stubEnv('MODE', 'preview')
      const { isDev } = await loadEnvModule()
      expect(isDev).toBe(true)
    })

    it('is false when MODE is production', async () => {
      vi.stubEnv('MODE', 'production')
      vi.stubEnv('VITE_SUPABASE_URL', VALID_URL)
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', VALID_KEY)
      const { isDev } = await loadEnvModule()
      expect(isDev).toBe(false)
    })
  })

  describe('valid configuration', () => {
    it('returns parsed env when all required vars are present', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', VALID_URL)
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', VALID_KEY)
      vi.stubEnv('MODE', 'production')

      const { env, isSupabaseConfigured } = await loadEnvModule()

      expect(env).not.toBeNull()
      expect(env?.VITE_SUPABASE_URL).toBe(VALID_URL)
      expect(env?.VITE_SUPABASE_ANON_KEY).toBe(VALID_KEY)
      expect(isSupabaseConfigured).toBe(true)
    })
  })

  describe('development mode — graceful fallback', () => {
    it('returns null and warns (does not throw) when vars are missing in dev', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', '')
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
      vi.stubEnv('MODE', 'development')

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { env, isSupabaseConfigured } = await loadEnvModule()

      expect(env).toBeNull()
      expect(isSupabaseConfigured).toBe(false)
      expect(warnSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
    })

    it('returns null and warns when URL is invalid in dev', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', 'not-a-url')
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', VALID_KEY)
      vi.stubEnv('MODE', 'development')

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { env } = await loadEnvModule()

      expect(env).toBeNull()
      expect(warnSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
    })
  })

  describe('production mode — strict validation', () => {
    it('throws a formatted error when vars are missing in production', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', '')
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
      vi.stubEnv('MODE', 'production')

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(loadEnvModule()).rejects.toThrow(
        /missing required environment variables/i,
      )

      errorSpy.mockRestore()
    })

    it('throws when URL is invalid in production', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', 'not-a-url')
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', VALID_KEY)
      vi.stubEnv('MODE', 'production')

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(loadEnvModule()).rejects.toThrow()

      errorSpy.mockRestore()
    })

    it('error message names the missing variable', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', VALID_URL)
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
      vi.stubEnv('MODE', 'production')

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(loadEnvModule()).rejects.toThrow(/VITE_SUPABASE_ANON_KEY/)

      errorSpy.mockRestore()
    })
  })
})
