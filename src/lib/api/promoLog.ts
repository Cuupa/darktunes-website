import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { PromoLogEntry } from '@/types'

type DbClient = SupabaseClient<Database>
type PromoLogRow = Database['public']['Tables']['promo_log_entries']['Row']
export type PromoLogInsert = Database['public']['Tables']['promo_log_entries']['Insert']

function rowToPromoLogEntry(row: PromoLogRow): PromoLogEntry {
  return {
    id: row.id,
    artistId: row.artist_id,
    actionDate: row.action_date,
    description: row.description,
    budgetAmount: row.budget_amount,
    budgetCurrency: row.budget_currency,
    proofUrl: row.proof_url,
    proofR2Key: row.proof_r2_key,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export async function getPromoLogEntries(db: DbClient, artistId: string): Promise<PromoLogEntry[]> {
  const { data, error } = await db
    .from('promo_log_entries')
    .select('*')
    .eq('artist_id', artistId)
    .order('action_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(rowToPromoLogEntry)
}

export async function createPromoLogEntry(
  db: DbClient,
  data: PromoLogInsert,
): Promise<PromoLogEntry> {
  const { data: inserted, error } = await db
    .from('promo_log_entries')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(error.message)
  if (!inserted) throw new Error('No data returned from createPromoLogEntry')
  return rowToPromoLogEntry(inserted)
}

export async function deletePromoLogEntry(db: DbClient, id: string): Promise<void> {
  const { error } = await db.from('promo_log_entries').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Returns the proof_r2_key for a specific entry so the caller can clean up R2. */
export async function getPromoLogEntryR2Key(
  db: DbClient,
  id: string,
): Promise<string | null> {
  const { data, error } = await db
    .from('promo_log_entries')
    .select('proof_r2_key')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data?.proof_r2_key ?? null
}
