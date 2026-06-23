/**
 * src/lib/epk/recordEpkDownload.ts
 *
 * Fire-and-forget EPK download event logging (non-blocking).
 */

import { logEpkDownloadEvent, type LogEpkDownloadInput } from '@/lib/api/epkDownloadEvents'
import { hashIpForAnalytics } from '@/lib/epk/analyticsHash'

export function recordEpkDownloadAsync(
  input: LogEpkDownloadInput & { ip?: string },
): void {
  void (async () => {
    try {
      const { createServiceRoleSupabaseClient } = await import('@/lib/supabase/server')
      const db = await createServiceRoleSupabaseClient()
      await logEpkDownloadEvent(db, {
        artistId: input.artistId,
        source: input.source,
        shareLinkId: input.shareLinkId,
        ipHash: input.ipHash ?? (input.ip ? hashIpForAnalytics(input.ip) : undefined),
        userAgent: input.userAgent,
      })
    } catch (err) {
      console.error('[recordEpkDownload] failed:', err)
    }
  })()
}