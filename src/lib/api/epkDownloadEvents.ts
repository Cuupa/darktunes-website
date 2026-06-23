/**
 * src/lib/api/epkDownloadEvents.ts
 *
 * DAL for EPK PDF download analytics (epk_download_events table).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
export type EpkDownloadSource = 'portal' | 'share' | 'press'

export interface LogEpkDownloadInput {
  artistId: string
  source: EpkDownloadSource
  shareLinkId?: string
  ipHash?: string
  userAgent?: string
}

export interface EpkDownloadStats {
  total: number
  last30Days: number
  bySource: Record<EpkDownloadSource, number>
}

export async function logEpkDownloadEvent(
  db: DbClient,
  input: LogEpkDownloadInput,
): Promise<void> {
  const { error } = await db.from('epk_download_events').insert({
    artist_id: input.artistId,
    source: input.source,
    share_link_id: input.shareLinkId ?? null,
    ip_hash: input.ipHash ?? null,
    user_agent: input.userAgent ?? null,
  })

  if (error) throw new Error(error.message)
}

async function countDownloads(
  db: DbClient,
  artistId: string,
  filters?: { source?: EpkDownloadSource; since?: string },
): Promise<number> {
  let query = db
    .from('epk_download_events')
    .select('*', { count: 'exact', head: true })
    .eq('artist_id', artistId)

  if (filters?.source) query = query.eq('source', filters.source)
  if (filters?.since) query = query.gte('created_at', filters.since)

  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function getEpkDownloadStats(
  db: DbClient,
  artistId: string,
): Promise<EpkDownloadStats> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString()

  const [total, last30Days, portal, share, press] = await Promise.all([
    countDownloads(db, artistId),
    countDownloads(db, artistId, { since: thirtyDaysAgo }),
    countDownloads(db, artistId, { source: 'portal' }),
    countDownloads(db, artistId, { source: 'share' }),
    countDownloads(db, artistId, { source: 'press' }),
  ])

  return {
    total,
    last30Days,
    bySource: { portal, share, press },
  }
}