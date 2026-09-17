import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { getAdminInvoiceById, recordInvoicePayment } from '@/lib/api/artistInvoices'
import { assertSettlementPeriodWritableById } from '@/lib/api/settlementPeriods'
import {
  appendLedgerEntry,
  hasLedgerEntry,
  resolvePaymentLedgerEntryType,
} from '@/lib/api/settlementLedger'
import {
  completeSettlementOperation,
  getSettlementOperationById,
  insertSettlementOperation,
} from '@/lib/api/settlementOperations'
import { logFinancialEvent } from '@/lib/api/financialAudit'
import {
  decideInvoiceOperationReplay,
  hashInvoicePayload,
} from '@/lib/portal/invoiceOperation'
import { updateSalesStatementStatus } from '@/lib/api/salesStatements'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { emitNotification } from '@/lib/notifications/emit'
const paymentSchema = z.object({
  amountCents: z.number().int().positive(),
  paymentMethod: z.enum(['sepa', 'paypal', 'manual', 'other']),
  paymentReference: z.string().max(200).optional(),
  idempotencyKey: z.string().uuid(),
})

export const PATCH = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdmin(token)

  const id = req.nextUrl.pathname.split('/').at(-2)
  if (!id) throw new ApiError(400, 'Missing invoice id')

  const body: unknown = await req.json()
  const parsed = paymentSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((i) => i.message).join('; '))
  }

  const supabase = await createServerSupabaseClient()
  const serviceSupabase = await createServiceRoleSupabaseClient()

  // Durable operation identity (#628): the client key is the operation id.
  // Same key + same payload replays the stored result; a different payload is
  // a conflict. Unlike idempotency_keys this record has no 24h TTL.
  const operationId = parsed.data.idempotencyKey
  const payloadHash = hashInvoicePayload({
    invoice_id: id,
    amount_cents: parsed.data.amountCents,
    payment_method: parsed.data.paymentMethod,
    payment_reference: parsed.data.paymentReference ?? null,
    actor_id: userId,
  })

  const existingOperation = await getSettlementOperationById(serviceSupabase, operationId)
  const storedInvoiceId =
    existingOperation && typeof existingOperation.result.invoice_id === 'string'
      ? existingOperation.result.invoice_id
      : undefined
  const replay = decideInvoiceOperationReplay(
    existingOperation
      ? { payloadHash: existingOperation.payloadHash, invoiceId: storedInvoiceId }
      : null,
    payloadHash,
  )

  if (replay === 'conflict') {
    throw new ApiError(409, 'Operation already used with a different payload')
  }

  if (replay === 'replay' && storedInvoiceId) {
    const replayed = await getAdminInvoiceById(supabase, storedInvoiceId)
    if (replayed) {
      return NextResponse.json({ invoice: replayed, duplicate: true })
    }
  }

  if (!existingOperation) {
    await insertSettlementOperation(serviceSupabase, {
      id: operationId,
      operationType: 'invoice_payment',
      resourceType: 'artist_invoice',
      resourceId: id,
      actorId: userId,
      amountCents: parsed.data.amountCents,
      payloadHash,
    })
  }

  const existing = await getAdminInvoiceById(supabase, id)
  if (!existing) throw new ApiError(404, 'Invoice not found')
  if (existing.settlementPeriodId) {
    await assertSettlementPeriodWritableById(supabase, existing.settlementPeriodId)
  }

  const invoice = await recordInvoicePayment(supabase, id, {
    amountCents: parsed.data.amountCents,
    paymentMethod: parsed.data.paymentMethod,
    paymentReference: parsed.data.paymentReference,
    actorId: userId,
  })

  // The payment is persisted at this point. Follow-ups must never trigger a
  // re-payment on retry — they are surfaced as warnings and the operation is
  // completed with the invoice id.
  const warnings: string[] = []

  try {
    // Statement-linked invoices already book invoice_liability (−amount) when created.
    // A second payment ledger row would double-count and leave open balance negative.
    // Free invoices without liability still post payment/partial_payment to the ledger.
    const alreadyHasLiability = await hasLedgerEntry(
      supabase,
      'artist_invoice',
      invoice.id,
      'invoice_liability',
    )
    const paymentEntryType = resolvePaymentLedgerEntryType(alreadyHasLiability, invoice.status)
    if (paymentEntryType) {
      await appendLedgerEntry(supabase, {
        artistId: invoice.artistId,
        settlementPeriodId: invoice.settlementPeriodId ?? null,
        entryType: paymentEntryType,
        amountEur: -parsed.data.amountCents / 100,
        currency: invoice.currency,
        referenceType: 'artist_invoice',
        referenceId: invoice.id,
        description: `Payment ${parsed.data.paymentReference ?? invoice.invoiceNumber}`,
        createdBy: userId,
      })
    }
  } catch (err) {
    console.error('[invoice payment] ledger entry failed:', err)
    warnings.push('ledger_entry_failed')
  }

  if (invoice.statementId && invoice.status === 'paid') {
    try {
      await updateSalesStatementStatus(supabase, invoice.statementId, 'paid')
    } catch (err) {
      console.error('[invoice payment] statement status update failed:', err)
      warnings.push('statement_status_failed')
    }
  }

  try {
    await logFinancialEvent(supabase, {
      entityType: 'artist_invoice',
      entityId: id,
      action: 'record_payment',
      actorId: userId,
      afterData: {
        status: invoice.status,
        paid_amount_cents: invoice.paidAmountCents,
        payment_reference: parsed.data.paymentReference,
        operation_id: operationId,
      },
    })
  } catch (err) {
    console.error('[invoice payment] audit failed:', err)
    warnings.push('audit_failed')
  }

  try {
    await completeSettlementOperation(serviceSupabase, operationId, { invoice_id: invoice.id })
  } catch (err) {
    console.error('[invoice payment] operation completion failed:', err)
    warnings.push('operation_record_failed')
  }

  if (invoice.status === 'paid' || invoice.status === 'partially_paid') {
    try {
      await emitNotification(serviceSupabase, {
        type: 'invoice_payment_received',
        entityId: invoice.id,
        entityName: `Payment on invoice ${invoice.invoiceNumber}`,
        artistId: invoice.artistId,
        senderId: userId,
        payload: {
          status: invoice.status,
          amountCents: parsed.data.amountCents,
        },
        dedupeKey: `invoice_payment_received:${invoice.id}:${invoice.paidAmountCents ?? parsed.data.amountCents}`,
      })
    } catch (notifErr) {
      console.error('[invoice payment] artist notify failed:', notifErr)
      warnings.push('notify_failed')
    }
  }

  return NextResponse.json({ invoice, warnings })
})
