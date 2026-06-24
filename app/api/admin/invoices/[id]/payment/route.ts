import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { getAdminInvoiceById, recordInvoicePayment } from '@/lib/api/artistInvoices'
import { assertSettlementPeriodWritableById } from '@/lib/api/settlementPeriods'
import { appendLedgerEntry } from '@/lib/api/settlementLedger'
import { logFinancialEvent } from '@/lib/api/financialAudit'
import {
  checkAndClaimIdempotencyKey,
  getIdempotencyKeyRecord,
  releaseIdempotencyKey,
  updateIdempotencyKeyResourceId,
} from '@/lib/api/idempotency'
import { updateSalesStatementStatus } from '@/lib/api/salesStatements'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from '@/lib/supabase/server'

const paymentSchema = z.object({
  amountCents: z.number().int().positive(),
  paymentMethod: z.enum(['sepa', 'paypal', 'manual', 'other']),
  paymentReference: z.string().max(200).optional(),
  idempotencyKey: z.string().uuid().optional(),
})

export const PATCH = withErrorHandler(async (req: NextRequest): Promise<NextResponse> => {
  const token = extractBearerToken(req.headers.get('authorization'))
  const userId = await verifyAdminOrEditor(token)

  const id = req.nextUrl.pathname.split('/').at(-2)
  if (!id) throw new ApiError(400, 'Missing invoice id')

  const body: unknown = await req.json()
  const parsed = paymentSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((i) => i.message).join('; '))
  }

  const supabase = await createServerSupabaseClient()
  const serviceSupabase = await createServiceRoleSupabaseClient()

  if (parsed.data.idempotencyKey) {
    const claimed = await checkAndClaimIdempotencyKey(
      serviceSupabase,
      parsed.data.idempotencyKey,
      'invoice-payment',
    )
    if (!claimed) {
      const existingKey = await getIdempotencyKeyRecord(serviceSupabase, parsed.data.idempotencyKey)
      if (existingKey?.resourceId) {
        const replayed = await getAdminInvoiceById(supabase, existingKey.resourceId)
        if (replayed) {
          return NextResponse.json({ invoice: replayed })
        }
      }
      throw new ApiError(409, 'Duplicate payment request')
    }
  }

  try {
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

    const entryType = invoice.status === 'paid' ? 'payment' : 'partial_payment'
    await appendLedgerEntry(supabase, {
      artistId: invoice.artistId,
      settlementPeriodId: invoice.settlementPeriodId ?? null,
      entryType,
      amountEur: -parsed.data.amountCents / 100,
      currency: invoice.currency,
      referenceType: 'artist_invoice',
      referenceId: invoice.id,
      description: `Payment ${parsed.data.paymentReference ?? invoice.invoiceNumber}`,
      createdBy: userId,
    })

    if (invoice.statementId && invoice.status === 'paid') {
      await updateSalesStatementStatus(supabase, invoice.statementId, 'paid')
    }

    await logFinancialEvent(supabase, {
      entityType: 'artist_invoice',
      entityId: id,
      action: 'record_payment',
      actorId: userId,
      afterData: {
        status: invoice.status,
        paid_amount_cents: invoice.paidAmountCents,
        payment_reference: parsed.data.paymentReference,
        idempotency_key: parsed.data.idempotencyKey,
      },
    })

    if (parsed.data.idempotencyKey) {
      await updateIdempotencyKeyResourceId(serviceSupabase, parsed.data.idempotencyKey, invoice.id)
    }

    return NextResponse.json({ invoice })
  } catch (err) {
    if (parsed.data.idempotencyKey) {
      await releaseIdempotencyKey(serviceSupabase, parsed.data.idempotencyKey)
    }
    throw err
  }
})