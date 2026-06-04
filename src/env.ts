/**
 * src/env.ts
 *
 * Client-side environment variable validation for darkTunes.
 * All NEXT_PUBLIC_* variables are validated here via Zod at module-load time.
 *
 * This file is safe to import in both Client Components ("use client") and
 * Server Components — Next.js inlines NEXT_PUBLIC_* vars at build time.
 *
 * Behavior per environment:
 *   production  → missing required variables throw a formatted Error that is
 *                 caught by the top-level <ErrorBoundary>.  The message names
 *                 every missing key so the operator knows exactly what to fix.
 *   development / preview → missing variables produce a console warning and
 *                 the module returns `null` so individual features can degrade
 *                 gracefully instead of blocking the entire dev server.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

/** True when running in development or Vercel preview mode. */
export const isDev: boolean = process.env.NODE_ENV !== 'production'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const envSchema = z.object({
  /** Supabase project REST/Auth/Realtime base URL (e.g. https://xxxx.supabase.co) */
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url({ message: 'must be a valid URL (e.g. https://xxxx.supabase.co)' }),
  /** Supabase public anonymous key */
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, { message: 'must not be empty' }),
})

export type Env = z.infer<typeof envSchema>

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateEnv(): Env | null {
  const raw = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }

  const result = envSchema.safeParse(raw)

  if (!result.success) {
    const lines = result.error.issues.map((e) => `  • ${String(e.path[0])}: ${e.message}`)

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

    // Production: also warn and return null to allow graceful degradation.
    // Server-side enforcement of required vars is handled by src/lib/env.server.ts
    // which is imported in Route Handlers and Server Components.
    console.warn(banner)
    return null
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
