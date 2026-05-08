/**
 * src/env.ts
 *
 * Central environment-variable validation for darkTunes.
 * All VITE_* variables are validated here via Zod at module-load time.
 *
 * Behaviour per environment:
 *   production  → missing required variables throw a formatted Error that is
 *                 caught by the top-level <ErrorBoundary>.  The message names
 *                 every missing key so the operator knows exactly what to fix.
 *   development / preview → missing variables produce a console warning and
 *                 the module returns `null` so individual features can degrade
 *                 gracefully instead of blocking the entire dev server.
 *
 * Note: This is a Vite SPA (browser runtime).  `process.exit(1)` is not
 * available in the browser, so a throw is used instead.  The ErrorBoundary in
 * src/main.tsx surfaces the formatted message to the developer.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

/** True when running in development or Vercel preview mode. */
export const isDev: boolean =
  import.meta.env.MODE === 'development' || import.meta.env.MODE === 'preview'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const envSchema = z.object({
  /** Supabase project REST/Auth/Realtime base URL (e.g. https://xxxx.supabase.co) */
  VITE_SUPABASE_URL: z.string().url({ message: 'must be a valid URL (e.g. https://xxxx.supabase.co)' }),
  /** Supabase public anonymous key */
  VITE_SUPABASE_ANON_KEY: z.string().min(1, { message: 'must not be empty' }),
})

export type Env = z.infer<typeof envSchema>

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateEnv(): Env | null {
  const raw = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  }

  const result = envSchema.safeParse(raw)

  if (!result.success) {
    const lines = result.error.errors.map(
      (e) => `  • ${String(e.path[0])}: ${e.message}`,
    )

    const banner = [
      '',
      '╔══════════════════════════════════════════════════════╗',
      '║   darkTunes — Missing Environment Variables          ║',
      '╚══════════════════════════════════════════════════════╝',
      '',
      'The following required environment variables are missing or invalid:',
      ...lines,
      '',
      'Copy .env.example to .env.local and fill in the values.',
      'See DEPLOYMENT.md for a full description of each variable.',
      '',
    ].join('\n')

    if (isDev) {
      // In development, warn and continue — features that need the missing
      // vars will degrade gracefully (see isSupabaseConfigured below).
      console.warn(banner)
      console.warn(
        '[darkTunes] Development mode: Supabase features will be disabled until env vars are set.',
      )
      return null
    }

    // Production / CI: surface the error as loudly as possible.
    console.error(banner)
    throw new Error(
      `darkTunes: missing required environment variables:\n${lines.join('\n')}`,
    )
  }

  return result.data
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * Validated environment variables.
 * `null` only in development/preview when variables are absent.
 */
export const env: Env | null = validateEnv()

/** Whether the Supabase client can be fully initialised. */
export const isSupabaseConfigured: boolean = env !== null
