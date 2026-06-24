/**
 * src/lib/env.server.ts
 *
 * Server-side environment variable validation using Zod.
 * Runs at module load time in Next.js Server Components and Route Handlers.
 *
 * NEXT_PUBLIC_* vars are available server-side as process.env.NEXT_PUBLIC_*.
 * Non-prefixed vars (R2 keys, service role key) are server-only.
 *
 * External integration API keys (Spotify, Resend, etc.) are stored encrypted
 * in api_credentials — see src/lib/secrets/getExternalCredentials.ts.
 *
 * If any required variable is missing, this module throws with a clear error
 * message so the build/startup fails loudly rather than crashing at runtime.
 */

import { z } from 'zod'

const serverEnvSchema = z.object({
  /** Supabase project URL (available both client and server) */
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url({ message: 'must be a valid URL (e.g. https://xxxx.supabase.co)' }),
  /** Supabase anonymous key (available both client and server) */
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, { message: 'must not be empty' }),
  /** Supabase service-role key — server-side only, never expose to browser */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, { message: 'must not be empty' }),
  /** Cloudflare R2 account ID */
  CLOUDFLARE_R2_ACCOUNT_ID: z.string().min(1, { message: 'must not be empty' }),
  /** Cloudflare R2 access key ID */
  CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().min(1, { message: 'must not be empty' }),
  /** Cloudflare R2 secret access key */
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().min(1, { message: 'must not be empty' }),
  /** Cloudflare R2 bucket name */
  CLOUDFLARE_R2_BUCKET_NAME: z.string().min(1, { message: 'must not be empty' }),
  /** Cloudflare R2 public CDN base URL */
  CLOUDFLARE_R2_PUBLIC_URL: z
    .string()
    .url({ message: 'must be a valid URL (e.g. https://cdn.darktunes.com)' }),
  /**
   * Master key for AES-256-GCM encryption of api_credentials values.
   * Generate with: openssl rand -hex 32
   * Stored only in Vercel env — never in Supabase or the browser.
   */
  API_CREDENTIALS_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, {
      message: 'must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32',
    }),
  /** Cron job secret — protects sync/health cron endpoints from unauthorised triggers */
  CRON_SECRET: z
    .string()
    .optional()
    .describe('****** used to authenticate Vercel cron calls to /api/sync'),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

function validateServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CLOUDFLARE_R2_ACCOUNT_ID: process.env.CLOUDFLARE_R2_ACCOUNT_ID,
    CLOUDFLARE_R2_ACCESS_KEY_ID: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    CLOUDFLARE_R2_BUCKET_NAME: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    CLOUDFLARE_R2_PUBLIC_URL: process.env.CLOUDFLARE_R2_PUBLIC_URL,
    API_CREDENTIALS_ENCRYPTION_KEY: process.env.API_CREDENTIALS_ENCRYPTION_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
  })

  if (!result.success) {
    const lines = result.error.issues.map((e) => `  • ${String(e.path[0])}: ${e.message}`)

    const banner = [
      '',
      '╔══════════════════════════════════════════════════════╗',
      '║   darkTunes — Missing Server Environment Variables   ║',
      '╚══════════════════════════════════════════════════════╝',
      '',
      'The following required server-side environment variables are missing or invalid:',
      ...lines,
      '',
      'Copy .env.example to .env.local and fill in the values.',
      'See DEPLOYMENT.md for a full description of each variable.',
      '',
    ].join('\n')

    // In production/CI this terminates the process at startup.
    console.error(banner)
    throw new Error(
      `darkTunes: missing required server environment variables:\n${lines.join('\n')}`,
    )
  }

  return result.data
}

/**
 * Validated server-side environment variables.
 *
 * Only import this in Server Components, Route Handlers, and middleware.
 * Do NOT import in "use client" files.
 */
export const serverEnv: ServerEnv = validateServerEnv()