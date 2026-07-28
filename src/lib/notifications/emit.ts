/**
 * Central notification emit — all product workflows should call this
 * instead of inserting into editor_notifications / notifications directly.
 *
 * Uses the service-role client (bypasses RLS). Writers must not use the user JWT.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import { getCatalogEntry } from './catalog'
import { resolveArtistMemberUserIds, resolveStaffUserIds } from './recipients'
import type { EmitNotificationInput, EmitNotificationResult } from './types'

type DbClient = SupabaseClient<Database>

export async function emitNotification(
  db: DbClient,
  input: EmitNotificationInput,
): Promise<EmitNotificationResult> {
  const entry = getCatalogEntry(input.type)
  const entityType = input.entityType ?? entry.defaultEntityType

  let userIds = input.userIds
  if (!userIds) {
    if (entry.audience === 'staff') {
      userIds = await resolveStaffUserIds(db, entry.roles ?? ['admin', 'editor'])
    } else {
      if (!input.artistId) {
        throw new Error(`emitNotification(${input.type}): artistId is required for artist audience`)
      }
      userIds = await resolveArtistMemberUserIds(db, input.artistId)
    }
  }

  const uniqueUserIds = [...new Set(userIds.filter(Boolean))]
  if (uniqueUserIds.length === 0) {
    return { inserted: 0, userIds: [] }
  }

  const payload = (input.payload ?? {}) as Json
  const rows = uniqueUserIds.map((userId) => ({
    user_id: userId,
    artist_id: input.artistId ?? null,
    type: input.type,
    entity_type: entityType,
    entity_id: input.entityId,
    entity_name: input.entityName ?? null,
    sender_id: input.senderId ?? null,
    payload,
    dedupe_key: input.dedupeKey ?? null,
    read: false,
  }))

  const { error, data } = await db.from('notifications').insert(rows).select('id')

  if (error) {
    // Unique violation on dedupe — treat as success with 0 new rows
    if (error.code === '23505') {
      return { inserted: 0, userIds: uniqueUserIds }
    }
    throw new Error(error.message)
  }

  return { inserted: data?.length ?? rows.length, userIds: uniqueUserIds }
}
