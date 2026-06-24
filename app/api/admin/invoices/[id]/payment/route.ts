import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { extractBearerToken, verifyAdminOrEditor } from '@/lib/adminAuth'
import { recordInvoicePayment } from '@/lib/api/artistInvoices'
import { appendLedgerEntry } from '@/lib/api/settlementLedger'
import { logFinancialEvent } from '@/lib/api/financialAudit'
import { updateSalesStatementStatus } from '@/lib/api/salesStatements'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const paymentSchema = z.object({
  amountCents: z.number().int().positive(),
  paymentMethod: z.enum(['sepa', 'paypal', 'manual', 'other']),
  paymentReference: z.string().max(200).optional(),
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
    },
  })

  return NextResponse.json({ invoice })
})