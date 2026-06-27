/**
 * src/lib/appLog.ts
 *
 * Single source of truth for writes to the app_logs table.
 * Server-only — never import from client components.
 */

export type AppLogLevel = 'error' | 'warn' | 'info'

export interface WriteAppLogOptions {
  source: string
  level?: AppLogLevel
  message: string
  details?: Record<string, unknown>
  userId?: string | null
}

export async function writeAppLog(opts: WriteAppLogOptions): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) return

    const { createClient } = await import('@supabase/supabase-js')
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

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