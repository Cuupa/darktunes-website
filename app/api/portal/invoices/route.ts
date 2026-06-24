import { randomUUID } from 'crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getBillingProfile, isBillingProfileComplete } from '@/lib/api/artistBillingProfiles'
import {
  createArtistInvoice,
  createSosLinkedInvoice,
  getArtistInvoiceByStatementId,
  listArtistInvoices,
  updateInvoice,
} from '@/lib/api/artistInvoices'
import { getSalesStatementById, updateSalesStatementStatus } from '@/lib/api/salesStatements'
import { sendInvoiceEmail } from '@/lib/email/sendInvoiceEmail'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { generateInvoiceNumber } from '@/lib/portal/invoiceNumber'
import { generateInvoicePdf } from '@/lib/portal/invoicePdf'
import { LABEL_BILLING_PARTY, LABEL_CLIENT_EMAIL } from '@/lib/portal/labelBilling'
import { createR2Client } from '@/lib/r2Utils'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/server'
import { getEmailCredentials } from '@/lib/secrets/getExternalCredentials'

const lineItemSchema = z.object({
  description: z.string().min(1).max(500),
  qty: z.number().int().min(1),
  unit_price_cents: z.number().int().min(0),
})

const createInvoiceSchema = z.object({
  artist_id: z.string().uuid(),
  artist_invoice_number: z.string().trim().min(1).max(100),
  client_name: z.string().min(1).max(500),
  client_email: z.string().email(),
  client_address: z.string().max(1000).optional(),
  statement_id: z.string().uuid().optional(),
  line_items: z.array(lineItemSchema).min(1),
  currency: z.string().length(3).default('EUR'),
  tax_rate_pct: z.number().min(0).max(100).default(19),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  issued_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(4000).optional(),
  send_email: z.boolean().default(true),
  send_to_label: z.boolean().default(false),
})

function getLineItemSubtotal(lineItems: Array<{ qty: number; unit_price_cents: number }>): number {
  return lineItems.reduce((sum, lineItem) => sum + lineItem.qty * lineItem.unit_price_cents, 0)
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artist_id')
  if (!artistId) throw new ApiError(400, 'artist_id is required')

  const { supabase, artist } = await authenticatePortalBearerWithArtist(req, artistId)

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10))
  const { invoices, total } = await listArtistInvoices(supabase, artist.id, page)

  return NextResponse.json({ invoices, total, page })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body: unknown = await req.json()
  const parsed = createInvoiceSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((issue) => issue.message).join('; '))
  }

  const input = parsed.data
  const { supabase, artist } = await authenticatePortalBearerWithArtist(req, input.artist_id)

  const billingProfile = await getBillingProfile(supabase, artist.id)
  if (!billingProfile || !isBillingProfileComplete(billingProfile)) {
    throw new ApiError(422, 'Billing profile is incomplete')
  }

  const { serverEnv } = await import('@/lib/env.server')
  const serviceDb = await createServiceRoleSupabaseClient()
  const emailCredentials = await getEmailCredentials(serviceDb)

  const statement = input.statement_id
    ? await getSalesStatementById(supabase, input.statement_id, artist.id)
    : null

  if (input.statement_id && !statement) {
    throw new ApiError(404, 'Statement not found')
  }

  if (statement && !['label_approved', 'artist_notified'].includes(statement.status)) {
    throw new ApiError(422, 'Statement is not ready for invoice creation')
  }

  if (statement && statement.amountEur === undefined) {
    throw new ApiError(422, 'Statement amount is missing')
  }

  if (statement) {
    const existingLinkedInvoice = await getArtistInvoiceByStatementId(supabase, artist.id, statement.id)
    if (existingLinkedInvoice) {
      throw new ApiError(409, 'An invoice for this statement already exists')
    }

    const expectedSubtotal = Math.round((statement.amountEur ?? 0) * 100)
    const submittedSubtotal = getLineItemSubtotal(input.line_items)
    if (submittedSubtotal !== expectedSubtotal) {
      throw new ApiError(422, 'Statement-linked invoice amount does not match the approved statement')
    }
  }

  const issuedDate = input.issued_date ?? new Date().toISOString().slice(0, 10)
  const internalInvoiceNumber = await generateInvoiceNumber(supabase, artist.id)
  const effectiveTaxRate = billingProfile.isSmallBusiness ? 0 : input.tax_rate_pct

  const invoicePayload = {
    artistId: artist.id,
    invoiceNumber: internalInvoiceNumber,
    artistInvoiceNumber: input.artist_invoice_number,
    clientName: input.client_name,
    clientEmail: input.client_email,
    clientAddress: input.client_address,
    lineItems: input.line_items,
    currency: input.currency,
    taxRatePct: effectiveTaxRate,
    dueDate: input.due_date,
    issuedDate,
    notes: input.notes,
  }

  const invoice = statement
    ? await createSosLinkedInvoice(supabase, { ...invoicePayload, statementId: statement.id })
    : await createArtistInvoice(supabase, invoicePayload)

  const pdfBytes = generateInvoicePdf({
    invoiceNumber: input.artist_invoice_number,
    issuedDate,
    dueDate: input.due_date,
    artist: {
      name: billingProfile.legalName,
      street: billingProfile.street,
      postalCode: billingProfile.postalCode,
      city: billingProfile.city,
      country: billingProfile.country,
      taxNumber: billingProfile.taxNumber,
      vatId: billingProfile.vatId,
      email: billingProfile.paypalEmail,
    },
    label: LABEL_BILLING_PARTY,
    sosReference: statement ? statement.period : undefined,
    sosPeriod: statement?.period,
    lineItems: input.line_items.map((lineItem) => ({
      description: lineItem.description,
      qty: lineItem.qty,
      unitPriceCents: lineItem.unit_price_cents,
    })),
    currency: input.currency,
    taxRatePct: effectiveTaxRate,
    isSmallBusiness: billingProfile.isSmallBusiness,
    notes: input.notes,
  })

  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )
  const key = `invoices/${artist.id}/${randomUUID()}.pdf`
  await s3.send(
    new PutObjectCommand({
      Bucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: Buffer.from(pdfBytes),
      ContentType: 'application/pdf',
      ContentLength: pdfBytes.byteLength,
    }),
  )

  const pdfUrl = `${serverEnv.CLOUDFLARE_R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`
  const updatedInvoice = await updateInvoice(supabase, invoice.id, artist.id, {
    pdf_url: pdfUrl,
    status: input.send_email ? 'sent' : 'draft',
  })

  if (statement?.status === 'label_approved') {
    await updateSalesStatementStatus(supabase, statement.id, 'acknowledged')
  }

  if (input.send_email) {
    await sendInvoiceEmail(
      {
        artistName: artist.name,
        invoiceNumber: input.artist_invoice_number,
        clientEmail: input.client_email,
        clientName: input.client_name,
        pdfUrl,
      },
      {
        resendApiKey: emailCredentials.resendApiKey ?? '',
        resendFromEmail: emailCredentials.resendFromEmail ?? '',
        fetch: globalThis.fetch,
      },
    )
  }

  if (input.send_to_label && input.client_email !== LABEL_CLIENT_EMAIL) {
    await sendInvoiceEmail(
      {
        artistName: artist.name,
        invoiceNumber: input.artist_invoice_number,
        clientEmail: LABEL_CLIENT_EMAIL,
        clientName: LABEL_BILLING_PARTY.name,
        pdfUrl,
      },
      {
        resendApiKey: emailCredentials.resendApiKey ?? '',
        resendFromEmail: emailCredentials.resendFromEmail ?? '',
        fetch: globalThis.fetch,
      },
    )
  }

  return NextResponse.json({ invoice: updatedInvoice, pdf_url: pdfUrl }, { status: 201 })
})