import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  computeCarryForwardOpeningBalance,
  getOutstandingBalancesForPeriod,
  resolveCarryStatementBalance,
  unpaidInvoiceContributionCents,
  type CarryForwardBreakdown,
} from '@/lib/api/settlementLedger'
import { reconcileRegisterOpenBalance } from '@/lib/api/settlementReconciliation'
import { listInvoicesByStatementIds } from '@/lib/api/artistInvoices'
import { getSalesStatementsForPeriod } from '@/lib/api/salesStatements'
import {
  getSettlementPeriodByDates,
  type SettlementPeriod,
} from '@/lib/api/settlementPeriods'

type DbClient = SupabaseClient<Database>

export interface SettlementRegisterRow {
  artistId: string
  artistName: string
  statementId: string | undefined
  statementStatus: string | undefined
  firstViewedAt: string | undefined
  statementAmountEur: number | undefined
  invoiceId: string | undefined
  invoiceStatus: string | undefined
  invoiceNumber: string | undefined
  invoiceDeliveryStatus?: 'not_sent' | 'sent' | 'failed'
  receivedAt: string | undefined
  paidAt: string | undefined
  paidAmountCents: number
  outstandingAmountCents: number | undefined
  ledgerBalanceEur: number
  carryForwardEur: number | undefined
  openingBalanceEur: number | undefined
}

export interface SettlementRegister {
  period: SettlementPeriod | null
  rows: SettlementRegisterRow[]
  kpis: {
    approved: number
    viewed: number
    invoiced: number
    received: number
    paid: number
    openBalanceEur: number
  }
}

export async function buildSettlementRegister(
  db: DbClient,
  periodStart: string,
  periodEnd: string,
): Promise<SettlementRegister> {
  const period = await getSettlementPeriodByDates(db, periodStart, periodEnd)
  const statements = await getSalesStatementsForPeriod(db, periodStart, periodEnd)
  const statementByArtist = new Map<string, (typeof statements)[number]>()
  for (const statement of statements) {
    if (!statementByArtist.has(statement.artist_id)) {
      statementByArtist.set(statement.artist_id, statement)
    }
  }

  const invoices = await listInvoicesByStatementIds(
    db,
    statements.map((s) => s.id),
  )
  const invoiceByStatement = new Map(invoices.map((inv) => [inv.statementId, inv]))

  const balances = period
    ? await getOutstandingBalancesForPeriod(db, period.id)
    : new Map<string, number>()

  const { data: carryRows } = period
    ? await db
        .from('period_carry_forwards')
        .select('artist_id, opening_balance_eur')
        .eq('from_period_id', period.id)
    : { data: [] as Array<{ artist_id: string; opening_balance_eur: number | string }> }

  const { data: openingRows } = period
    ? await db
        .from('period_carry_forwards')
        .select('artist_id, opening_balance_eur')
        .eq('to_period_id', period.id)
    : { data: [] as Array<{ artist_id: string; opening_balance_eur: number | string }> }

  const carryByArtist = new Map(
    (carryRows ?? []).map((row) => [row.artist_id, Number(row.opening_balance_eur)]),
  )
  const openingByArtist = new Map(
    (openingRows ?? []).map((row) => [row.artist_id, Number(row.opening_balance_eur)]),
  )

  const artistIds = new Set<string>([
    ...statementByArtist.keys(),
    ...balances.keys(),
    ...carryByArtist.keys(),
    ...openingByArtist.keys(),
  ])

  const { data: artists, error: artistsError } = artistIds.size
    ? await db.from('artists').select('id, name').in('id', [...artistIds]).order('name')
    : { data: [] as Array<{ id: string; name: string }>, error: null }

  if (artistsError) throw new Error(artistsError.message)

  const rows: SettlementRegisterRow[] = []
  const artistRows = artists ?? []

  for (const artist of artistRows) {
    const statement = statementByArtist.get(artist.id)
    const invoice = statement ? invoiceByStatement.get(statement.id) : undefined
    const ledgerBalance = balances.get(artist.id) ?? 0

    rows.push({
      artistId: artist.id,
      artistName: artist.name,
      statementId: statement?.id,
      statementStatus: statement?.status,
      firstViewedAt: statement?.first_viewed_at ?? undefined,
      statementAmountEur: statement?.amount_eur != null ? Number(statement.amount_eur) : undefined,
      invoiceId: invoice?.id,
      invoiceStatus: invoice?.status,
      invoiceNumber: invoice?.artistInvoiceNumber ?? invoice?.invoiceNumber,
      invoiceDeliveryStatus: invoice?.deliveryStatus,
      receivedAt: invoice?.receivedAt,
      paidAt: invoice?.paidAt,
      paidAmountCents: invoice?.paidAmountCents ?? 0,
      outstandingAmountCents: invoice?.outstandingAmountCents,
      ledgerBalanceEur: ledgerBalance,
      carryForwardEur: carryByArtist.get(artist.id),
      openingBalanceEur: openingByArtist.get(artist.id),
    })
  }

  const activeRows = rows.filter((row) => row.statementId)
  const openBalanceEur = rows.reduce((sum, r) => sum + r.ledgerBalanceEur, 0)
  const kpis = {
    approved: activeRows.filter((r) =>
      r.statementStatus && ['label_approved', 'artist_notified', 'viewed', 'invoiced', 'paid', 'acknowledged'].includes(r.statementStatus),
    ).length,
    viewed: activeRows.filter((r) => r.firstViewedAt).length,
    invoiced: activeRows.filter((r) => r.invoiceId).length,
    received: activeRows.filter((r) => r.receivedAt).length,
    paid: activeRows.filter((r) => r.paidAt || r.invoiceStatus === 'paid').length,
    openBalanceEur,
  }

  const balanceCheck = reconcileRegisterOpenBalance(
    rows.map((row) => ({ artistId: row.artistId, ledgerBalanceEur: row.ledgerBalanceEur })),
    openBalanceEur,
  )
  if (!balanceCheck.ok) {
    console.warn('[buildSettlementRegister] open balance invariant failed', balanceCheck)
  }

  return { period, rows: rows.filter((r) => r.statementId || r.ledgerBalanceEur !== 0), kpis }
}

export async function computeCarryForwardBalances(
  db: DbClient,
  periodId: string,
): Promise<Array<{ artistId: string; openingBalanceEur: number; breakdown: CarryForwardBreakdown }>> {
  const { data: statements, error } = await db
    .from('sales_statements')
    .select('id, artist_id, amount_eur, status')
    .eq('settlement_period_id', periodId)
    .neq('document_type', 'storno')

  if (error) throw new Error(error.message)

  const results: Array<{
    artistId: string
    openingBalanceEur: number
    breakdown: CarryForwardBreakdown
  }> = []

  const artistIds = [...new Set((statements ?? []).map((s) => s.artist_id))]
  if (artistIds.length === 0) return results

  // Batch the per-artist loads (previously one ledger + one invoice query per
  // artist). Only the `carry_out` bookkeeping written by this close is excluded
  // so the recomputed opening balance stays stable on a retry; a period's
  // incoming `carry_in` from the previous close IS part of its balance.
  const { data: ledgerRows, error: ledgerError } = await db
    .from('artist_settlement_ledger')
    .select('artist_id, entry_type, amount_eur')
    .eq('settlement_period_id', periodId)
    .in('artist_id', artistIds)
  if (ledgerError) throw new Error(ledgerError.message)

  const { data: invoiceRows, error: invoiceError } = await db
    .from('artist_invoices')
    .select('artist_id, line_items, paid_amount_cents, outstanding_amount_cents, status')
    .eq('settlement_period_id', periodId)
    .in('artist_id', artistIds)
  if (invoiceError) throw new Error(invoiceError.message)

  const statementsByArtist = new Map<string, NonNullable<typeof statements>>()
  for (const statement of statements ?? []) {
    const list: NonNullable<typeof statements> = statementsByArtist.get(statement.artist_id) ?? []
    list.push(statement)
    statementsByArtist.set(statement.artist_id, list)
  }

  const ledgerByArtist = new Map<string, { balanceEur: number; entryCount: number }>()
  for (const row of ledgerRows ?? []) {
    if (row.entry_type === 'carry_out') continue
    const current = ledgerByArtist.get(row.artist_id) ?? { balanceEur: 0, entryCount: 0 }
    current.balanceEur += Number(row.amount_eur)
    current.entryCount += 1
    ledgerByArtist.set(row.artist_id, current)
  }

  const invoicesByArtist = new Map<string, NonNullable<typeof invoiceRows>>()
  for (const invoice of invoiceRows ?? []) {
    const list: NonNullable<typeof invoiceRows> = invoicesByArtist.get(invoice.artist_id) ?? []
    list.push(invoice)
    invoicesByArtist.set(invoice.artist_id, list)
  }

  for (const artistId of artistIds) {
    const artistStatements = statementsByArtist.get(artistId) ?? []
    const statementBalance = artistStatements.reduce((sum, s) => {
      if (['paid', 'invoiced', 'acknowledged'].includes(s.status)) return sum
      return sum + Number(s.amount_eur ?? 0)
    }, 0)

    const ledger = ledgerByArtist.get(artistId) ?? { balanceEur: 0, entryCount: 0 }

    let unpaidInvoiceCents = 0
    let partialRemainder = 0
    for (const inv of invoicesByArtist.get(artistId) ?? []) {
      const contribution = unpaidInvoiceContributionCents(inv)
      if (contribution <= 0) continue
      if (Number(inv.paid_amount_cents ?? 0) > 0) partialRemainder += contribution
      else unpaidInvoiceCents += contribution
    }

    const breakdown: CarryForwardBreakdown = {
      statementBalanceEur: resolveCarryStatementBalance(
        ledger.entryCount > 0,
        ledger.balanceEur,
        statementBalance,
      ),
      unpaidInvoiceCents,
      partialPaymentRemainderCents: partialRemainder,
    }

    const openingBalanceEur = computeCarryForwardOpeningBalance(breakdown)
    if (Math.abs(openingBalanceEur) >= 0.005) {
      results.push({ artistId, openingBalanceEur, breakdown })
    }
  }

  return results
}

export async function archivePeriodWithCarryForward(
  db: DbClient,
  periodId: string,
  actorId: string,
  nextPeriodStart: string,
  nextPeriodEnd: string,
): Promise<void> {
  const { archiveSettlementPeriod, getOrCreateSettlementPeriod, getSettlementPeriodById } =
    await import('@/lib/api/settlementPeriods')
  const { createPeriodCarryForwards, appendLedgerEntry } = await import('@/lib/api/settlementLedger')

  // Idempotent close: an already-archived period must not post a second
  // carry-out on retry or double-click (#628 / contract §A.5).
  const period = await getSettlementPeriodById(db, periodId)
  if (!period) throw new Error('Settlement period not found')
  if (period.status === 'archived') return

  const balances = await computeCarryForwardBalances(db, periodId)
  await createPeriodCarryForwards(db, periodId, balances, actorId)

  const nextPeriod = await getOrCreateSettlementPeriod(db, nextPeriodStart, nextPeriodEnd)

  for (const row of balances) {
    // Idempotent retry: an existing carry_in ledger row for this artist means
    // the carry was already applied. Repair the metadata instead of posting a
    // second opening balance.
    const { data: existingEntry, error: entryError } = await db
      .from('artist_settlement_ledger')
      .select('id')
      .eq('reference_type', 'settlement_period')
      .eq('reference_id', periodId)
      .eq('entry_type', 'carry_in')
      .eq('artist_id', row.artistId)
      .limit(1)
    if (entryError) throw new Error(entryError.message)

    const appliedAt = new Date().toISOString()

    if ((existingEntry?.length ?? 0) > 0) {
      const { error: repairError } = await db
        .from('period_carry_forwards')
        .update({ to_period_id: nextPeriod.id, applied_at: appliedAt })
        .eq('from_period_id', periodId)
        .eq('artist_id', row.artistId)
      if (repairError) throw new Error(repairError.message)
      continue
    }

    try {
      await appendLedgerEntry(db, {
        artistId: row.artistId,
        settlementPeriodId: nextPeriod.id,
        entryType: 'carry_in',
        amountEur: row.openingBalanceEur,
        referenceType: 'settlement_period',
        referenceId: periodId,
        description: 'Opening balance from previous period',
        createdBy: actorId,
      })
    } catch (err) {
      // A concurrent close already posted this carry_in (unique carry index);
      // fall through and make sure the metadata row is linked.
      if ((err as { code?: string }).code !== '23505') throw err
    }

    const { error: linkError } = await db
      .from('period_carry_forwards')
      .update({ to_period_id: nextPeriod.id, applied_at: appliedAt })
      .eq('from_period_id', periodId)
      .eq('artist_id', row.artistId)
    if (linkError) throw new Error(linkError.message)
  }

  await archiveSettlementPeriod(db, periodId, actorId)
}