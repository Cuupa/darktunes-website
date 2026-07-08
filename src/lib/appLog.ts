/**
 * src/lib/appLog.ts
 *
 * Single source of truth for writes to the app_logs table.
 * Server-only — never import from client components.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type AppLogLevel = 'error' | 'warn' | 'info'

export interface WriteAppLogOptions {
  source: string
  level?: AppLogLevel
  message: string
  details?: Record<string, unknown>
  userId?: string | null
}

let _logClient: SupabaseClient | null = null
let _logClientKey = ''

function getLogClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const cacheKey = `${url}|${key}`
  if (_logClient && _logClientKey === cacheKey) return _logClient
  _logClient = createClient(url, key, { auth: { persistSession: false } })
  _logClientKey = cacheKey
  return _logClient
}

/** For test isolation only — resets the cached Supabase client. */
export function _resetLogClientForTests(): void {
  _logClient = null
  _logClientKey = ''
}

export async function writeAppLog(opts: WriteAppLogOptions): Promise<void> {
  try {
    const db = getLogClient()
    if (!db) return

    const row: {
      source: string
      level: AppLogLevel
      message: string
      details: Record<string, unknown>
      user_id?: string
    } = {
      source: opts.source,
      level: opts.level ?? 'error',
      message: opts.message,
      details: opts.details ?? {},
    }

    if (opts.userId) {
      row.user_id = opts.userId
    }

    await db.from('app_logs').insert(row)
  } catch {
    // Never throw from the logger — silently ignore any DB failures
  }
}
