/**
 * src/lib/logServerActionError.ts
 *
 * Persists server action failures to app_logs for admin visibility.
 * Server-only.
 */

import { writeAppLog } from '@/lib/appLog'

export async function logServerActionError(
  action: string,
  err: unknown,
  userId?: string | null,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err)
  await writeAppLog({
    source: 'server_action',
    level: 'error',
    message: `[${action}] ${message}`,
    details: {
      action,
      stack: err instanceof Error ? (err.stack ?? null) : null,
    },
    userId: userId ?? null,
  })
}