/**
 * src/lib/env.server.ts
 *
 * Server-side environment variable validation using Zod.
 * Runs at module load time in Next.js Server Components and Route Handlers.
 *
 * NEXT_PUBLIC_* vars are available server-side as process.env.NEXT_PUBLIC_*.
 * Non-prefixed vars (R2 keys, service role key) are server-only.
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
  // ---------------------------------------------------------------------------
  // Optional external API keys — leave blank to disable the corresponding sync
  // ---------------------------------------------------------------------------
  /** Spotify Web API client ID (https://developer.spotify.com/dashboard) */
  SPOTIFY_CLIENT_ID: z
    .string()
    .optional()
    .describe('Spotify client ID — leave blank to disable Spotify sync'),
  /** Spotify Web API client secret */
  SPOTIFY_CLIENT_SECRET: z
    .string()
    .optional()
    .describe('Spotify client secret — leave blank to disable Spotify sync'),
  /** Discogs Personal Access Token (https://www.discogs.com/settings/developers) */
  DISCOGS_TOKEN: z
    .string()
    .optional()
    .describe('Discogs token — leave blank to disable Discogs sync'),
  /** Songkick API key (https://www.songkick.com/developer) */
  SONGKICK_API_KEY: z
    .string()
    .optional()
    .describe('Songkick API key — leave blank to disable Songkick sync'),
  /** Bandsintown API key (https://www.bandsintown.com/api/app_id → Request access) */
  BANDSINTOWN_API_KEY: z
    .string()
    .optional()
    .describe('Bandsintown API key — leave blank to disable Bandsintown sync'),
  /** Resend API key — used for contact form emails and SOS statement notifications */
  RESEND_API_KEY: z
    .string()
    .optional()
    .describe('Resend API key — leave blank to disable email notifications'),
  /** Resend verified sender address for outgoing emails */
  RESEND_FROM_EMAIL: z
    .string()
    .optional()
    .describe('Resend from address, e.g. noreply@darktunes.com'),
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
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
    DISCOGS_TOKEN: process.env.DISCOGS_TOKEN,
    SONGKICK_API_KEY: process.env.SONGKICK_API_KEY,
    BANDSINTOWN_API_KEY: process.env.BANDSINTOWN_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
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
