import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type DbClient = SupabaseClient<Database>
type LedgerRow = Database['public']['Tables']['artist_settlement_ledger']['Row']
export type LedgerEntryType = LedgerRow['entry_type']

export interface LedgerEntry {
  id: string
  artistId: string
  settlementPeriodId: string | undefined
  entryType: LedgerEntryType
  amountEur: number
  currency: string | undefined
  amountOriginal: number | undefined
  fxRate: number | undefined
  referenceType: string | undefined
  referenceId: string | undefined
  description: string | undefined
  createdBy: string | undefined
  createdAt: string
}

export interface AppendLedgerEntryInput {
  artistId: string
  settlementPeriodId?: string | null
  entryType: LedgerEntryType
  amountEur: number
  currency?: string | null
  amountOriginal?: number | null
  fxRate?: number | null
  referenceType?: string | null
  referenceId?: string | null
  description?: string | null
  createdBy?: string | null
}

function rowToEntry(row: LedgerRow): LedgerEntry {
  return {
    id: row.id,
    artistId: row.artist_id,
    settlementPeriodId: row.settlement_period_id ?? undefined,
    entryType: row.entry_type,
    amountEur: Number(row.amount_eur),
    currency: row.currency ?? undefined,
    amountOriginal: row.amount_original != null ? Number(row.amount_original) : undefined,
    fxRate: row.fx_rate != null ? Number(row.fx_rate) : undefined,
    referenceType: row.reference_type ?? undefined,
    referenceId: row.reference_id ?? undefined,
    description: row.description ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
  }
}

export async function appendLedgerEntry(
  db: DbClient,
  input: AppendLedgerEntryInput,
): Promise<LedgerEntry> {
  const { data, error } = await db
    .from('artist_settlement_ledger')
    .insert({
      artist_id: input.artistId,
      settlement_period_id: input.settlementPeriodId ?? null,
      entry_type: input.entryType,
      amount_eur: input.amountEur,
      currency: input.currency ?? null,
      amount_original: input.amountOriginal ?? null,
      fx_rate: input.fxRate ?? null,
      reference_type: input.referenceType ?? null,
      reference_id: input.referenceId ?? null,
      description: input.description ?? null,
      created_by: input.createdBy ?? null,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return rowToEntry(data as LedgerRow)
}

export async function getLedgerEntriesForArtist(
  db: DbClient,
  artistId: string,
  settlementPeriodId?: string,
): Promise<LedgerEntry[]> {
  let query = db
    .from('artist_settlement_ledger')
    .select('*')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: true })

  if (settlementPeriodId) {
    query = query.eq('settlement_period_id', settlementPeriodId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => rowToEntry(row as LedgerRow))
}

export function sumLedgerBalance(entries: LedgerEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.amountEur, 0)
}

export async function getArtistOutstandingBalance(
  db: DbClient,
  artistId: string,
  settlementPeriodId?: string,
): Promise<number> {
  const entries = await getLedgerEntriesForArtist(db, artistId, settlementPeriodId)
  return sumLedgerBalance(entries)
}

export interface CarryForwardBreakdown {
  statementBalanceEur: number
  unpaidInvoiceCents: number
  partialPaymentRemainderCents: number
}

export function computeCarryForwardOpeningBalance(breakdown: CarryForwardBreakdown): number {
  const invoiceEur = (breakdown.unpaidInvoiceCents + breakdown.partialPaymentRemainderCents) / 100
  return breakdown.statementBalanceEur + invoiceEur
}

export async function createPeriodCarryForwards(
  db: DbClient,
  fromPeriodId: string,
  artistBalances: Array<{
    artistId: string
    openingBalanceEur: number
    breakdown: CarryForwardBreakdown
  }>,
  actorId: string,
): Promise<void> {
  for (const row of artistBalances) {
    if (Math.abs(row.openingBalanceEur) < 0.005) continue

    await db.from('period_carry_forwards').upsert(
      {
        from_period_id: fromPeriodId,
        artist_id: row.artistId,
        opening_balance_eur: row.openingBalanceEur,
        breakdown: { ...row.breakdown },
      },
      { onConflict: 'from_period_id,artist_id' },
    )

    await appendLedgerEntry(db, {
      artistId: row.artistId,
      settlementPeriodId: fromPeriodId,
      entryType: 'carry_out',
      amountEur: -row.openingBalanceEur,
      referenceType: 'settlement_period',
      referenceId: fromPeriodId,
      description: 'Period carry-forward out',
      createdBy: actorId,
    })
  }
}

export async function getOpeningBalancesForPeriod(
  db: DbClient,
  toPeriodId: string,
): Promise<Database['public']['Tables']['period_carry_forwards']['Row'][]> {
  const { data, error } = await db
    .from('period_carry_forwards')
    .select('*')
    .eq('to_period_id', toPeriodId)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getUnappliedCarryForwards(
  db: DbClient,
  fromPeriodId: string,
): Promise<Database['public']['Tables']['period_carry_forwards']['Row'][]> {
  const { data, error } = await db
    .from('period_carry_forwards')
    .select('*')
    .eq('from_period_id', fromPeriodId)
    .is('applied_at', null)

  if (error) throw new Error(error.message)
  return data ?? []
}

export function invoiceTotalCents(lineItems: { qty: number; unit_price_cents: number }[]): number {
  return lineItems.reduce((sum, item) => sum + item.qty * item.unit_price_cents, 0)
}