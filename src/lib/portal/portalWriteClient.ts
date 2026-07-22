/**
 * src/lib/portal/portalWriteClient.ts
 *
 * Dual-path portal writes (Phase 2 canary):
 *   - Default: service-role client after membership check (current prod-safe path)
 *   - PORTAL_WRITES_USE_USER_JWT=1: try user JWT first; on RLS/permission failure
 *     fall back once to service-role and log `portal_rls_fallback`
 *
 * Always call only after resolvePortalArtist / membership verification.
 * Field allowlists stay in the route — this helper only chooses the DB client.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { writeAppLog } from '@/lib/appLog'

export type PortalDb = SupabaseClient<Database>

export interface PortalWriteContext {
  /** Route or action name, e.g. PUT /api/portal/profile */
  route: string
  /** Primary table being written */
  table: string
  /** Logical op for logs: upsert | update | insert | delete */
  operation: string
  artistId: string
  userId: string
}

/**
 * When true, attempt writes with the authenticated user client first.
 * Default false keeps today’s service-role-after-membership behaviour.
 */
export function isPortalUserJwtWritesEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  const raw = env.PORTAL_WRITES_USE_USER_JWT?.trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

/**
 * Detect Postgres/PostgREST RLS and privilege failures so we can fall back
 * without swallowing real validation / FK errors.
 */
export function isLikelyRlsOrPermissionError(err: unknown): boolean {
  if (err == null) return false

  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code ?? '')
      : ''

  // 42501 insufficient_privilege; PGRST301 JWT; PGRST116 often means RLS hid rows on .single()
  if (code === '42501' || code === 'PGRST301' || code === 'PGRST116') {
    return true
  }

  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()

  return (
    lower.includes('row-level security') ||
    lower.includes('row level security') ||
    lower.includes('violates row-level security') ||
    lower.includes('permission denied') ||
    lower.includes('not authorized') ||
    (lower.includes('jwt') && lower.includes('denied')) ||
    lower.includes('42501')
  )
}

export type PortalWriteResult<T> = {
  value: T
  /** Which client produced the successful write */
  via: 'user_jwt' | 'service_role'
  /** True when user JWT failed and service role succeeded */
  fellBack: boolean
}

/**
 * Execute a portal write under the canary policy.
 *
 * @param userDb      Bearer/session client (auth.uid() set)
 * @param serviceDb   Service-role client (RLS bypass)
 * @param context     Logging context
 * @param write       DAL callback; throw on failure
 */
export async function portalWriteWithCanary<T>(options: {
  userDb: PortalDb
  serviceDb: PortalDb
  context: PortalWriteContext
  write: (db: PortalDb) => Promise<T>
  /** Injected for tests */
  useUserJwt?: boolean
  logFallback?: typeof writeAppLog
}): Promise<PortalWriteResult<T>> {
  const useUserJwt = options.useUserJwt ?? isPortalUserJwtWritesEnabled()
  const log = options.logFallback ?? writeAppLog

  if (!useUserJwt) {
    const value = await options.write(options.serviceDb)
    return { value, via: 'service_role', fellBack: false }
  }

  try {
    const value = await options.write(options.userDb)
    return { value, via: 'user_jwt', fellBack: false }
  } catch (err) {
    if (!isLikelyRlsOrPermissionError(err)) {
      throw err
    }

    const message = err instanceof Error ? err.message : String(err)
    console.warn('[portal-write-canary] user JWT write failed; falling back to service role', {
      ...options.context,
      error: message,
    })

    // Fire-and-forget metric — never block the user save path
    void log({
      source: 'portal_rls_fallback',
      level: 'warn',
      message: `portal write fell back to service role: ${options.context.route} ${options.context.table}`,
      userId: options.context.userId,
      details: {
        route: options.context.route,
        table: options.context.table,
        operation: options.context.operation,
        artist_id: options.context.artistId,
        error: message,
      },
    })

    const value = await options.write(options.serviceDb)
    return { value, via: 'service_role', fellBack: true }
  }
}
