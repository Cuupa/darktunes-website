/**
 * src/lib/api/zammadSupport.ts
 *
 * DAL for support_known_errors and zammad_ticket_log tables.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Db = SupabaseClient<Database>
type KnownErrorRow = Database['public']['Tables']['support_known_errors']['Row']
type TicketLogRow = Database['public']['Tables']['zammad_ticket_log']['Row']
type TicketLogInsert = Database['public']['Tables']['zammad_ticket_log']['Insert']
type TicketLogStatus = TicketLogInsert['status']

const DEDUP_WINDOW_HOURS = 24

export async function isKnownErrorFingerprint(db: Db, fingerprint: string): Promise<boolean> {
  const { data, error } = await db
    .from('support_known_errors')
    .select('id')
    .eq('fingerprint', fingerprint)
    .eq('active', true)
    .maybeSingle()

  if (error) return false
  return data !== null
}

export async function hasRecentDuplicateTicket(
  db: Db,
  fingerprint: string,
  userId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  const { data, error } = await db
    .from('zammad_ticket_log')
    .select('id')
    .eq('fingerprint', fingerprint)
    .eq('user_id', userId)
    .eq('status', 'sent')
    .gte('created_at', since)
    .limit(1)
    .maybeSingle()

  if (error) return false
  return data !== null
}

export async function insertTicketLog(db: Db, row: TicketLogInsert): Promise<void> {
  await db.from('zammad_ticket_log').insert(row)
}

export async function listKnownErrors(db: Db): Promise<KnownErrorRow[]> {
  const { data, error } = await db
    .from('support_known_errors')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createKnownError(
  db: Db,
  input: { fingerprint: string; label: string; notes?: string | null; createdBy: string },
): Promise<KnownErrorRow> {
  const { data, error } = await db
    .from('support_known_errors')
    .insert({
      fingerprint: input.fingerprint,
      label: input.label,
      notes: input.notes ?? null,
      created_by: input.createdBy,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteKnownError(db: Db, id: string): Promise<void> {
  const { error } = await db.from('support_known_errors').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listTicketLog(
  db: Db,
  limit = 50,
): Promise<TicketLogRow[]> {
  const { data, error } = await db
    .from('zammad_ticket_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function resolveUserProfile(
  db: Db,
  userId: string,
  fallbackEmail?: string | null,
  fallbackName?: string | null,
): Promise<{ email: string; name: string }> {
  const { data } = await db
    .from('users')
    .select('email, full_name')
    .eq('id', userId)
    .maybeSingle()

  const email = data?.email ?? fallbackEmail ?? 'unknown@unknown'
  const name = data?.full_name?.trim() || fallbackName?.trim() || email

  return { email, name }
}

export type { TicketLogStatus }