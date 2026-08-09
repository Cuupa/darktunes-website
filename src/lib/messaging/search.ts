/**
 * Unified messaging search across label + portal streams for a given actor context.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { LabelMessage, PortalMessage } from '@/types'
import { searchLabelMessages } from '@/lib/api/labelMessages'
import { searchPortalMessages } from '@/lib/api/portalMessages'
import {
  MESSAGE_SEARCH_DEFAULT_LIMIT,
  resolveMessageListLimit,
  type MessageListOptions,
} from '@/lib/messaging/constants'

type DbClient = SupabaseClient<Database>

export type UnifiedMessageHit =
  | { source: 'label'; message: LabelMessage }
  | { source: 'portal'; message: PortalMessage }

/**
 * Search messages for one artist (portal context) or filter label stream by artist (admin).
 */
export async function searchArtistMailbox(
  db: DbClient,
  opts: {
    artistId: string
    query: string
    /** When true, also search label_messages for this artist. */
    includeLabel?: boolean
  } & MessageListOptions,
): Promise<UnifiedMessageHit[]> {
  const limit = resolveMessageListLimit(opts.limit, MESSAGE_SEARCH_DEFAULT_LIMIT)
  const half = Math.max(1, Math.floor(limit / 2))

  const portal = await searchPortalMessages(db, opts.artistId, opts.query, {
    limit: opts.includeLabel ? half : limit,
    offset: opts.offset,
  })

  const hits: UnifiedMessageHit[] = portal.map((message) => ({
    source: 'portal' as const,
    message,
  }))

  if (opts.includeLabel !== false) {
    const label = await searchLabelMessages(db, opts.query, {
      artistId: opts.artistId,
      limit: half,
      offset: opts.offset,
    })
    for (const message of label) {
      hits.push({ source: 'label', message })
    }
  }

  return hits
    .sort((a, b) => {
      const aAt = a.source === 'label' ? a.message.sentAt : a.message.sentAt
      const bAt = b.source === 'label' ? b.message.sentAt : b.message.sentAt
      return new Date(bAt).getTime() - new Date(aAt).getTime()
    })
    .slice(0, limit)
}
