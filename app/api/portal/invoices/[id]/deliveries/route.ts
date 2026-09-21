import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getArtistInvoice, updateInvoice } from '@/lib/api/artistInvoices'
import { sendInvoiceEmail } from '@/lib/email/sendInvoiceEmail'
import { serverEnv } from '@/lib/env.server'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { canRetryInvoiceDelivery } from '@/lib/portal/invoiceDelivery'
import { mintInvoicePdfToken } from '@/lib/portal/invoicePdfToken'
import { toPortalInvoiceListItem } from '@/lib/portal/invoiceUi'
import { portalMemberWrite, withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'
import { getEmailCredentials } from '@/lib/secrets/getExternalCredentials'

const bodySchema = z.object({
  artist_id: z.string().uuid(),
})

const ROUTE = 'POST /api/portal/invoices/[id]/deliveries'

export const POST = withErrorHandler(async (req: NextRequest) => {
  const id = req.nextUrl.pathname.split('/').at(-2)
  if (!id) throw new ApiError(400, 'Missing invoice id')

  const body: unknown = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((issue) => issue.message).join('; '))
  }

  const ctx = await withPortalMembershipWrite(req, parsed.data.artist_id)
  const { value: invoice } = await portalMemberWrite(
    ctx,
    { route: ROUTE, table: 'artist_invoices', operation: 'select' },
    (db) => getArtistInvoice(db, id, ctx.artist.id),
  )
  if (!invoice) throw new ApiError(404, 'Invoice not found')

  const retryable = canRetryInvoiceDelivery(invoice)
  if (!retryable.ok) throw new ApiError(retryable.status, retryable.message)

  const emailCredentials = await getEmailCredentials(ctx.serviceDb)
  const downloadToken = mintInvoicePdfToken(serverEnv.API_CREDENTIALS_ENCRYPTION_KEY, invoice.id)
  const downloadUrl = `${req.nextUrl.origin}/api/invoices/${invoice.id}/pdf?token=${encodeURIComponent(downloadToken)}`

  const result = await sendInvoiceEmail(
    {
      artistName: ctx.artist.name,
      invoiceNumber: invoice.artistInvoiceNumber ?? invoice.invoiceNumber,
      clientEmail: invoice.clientEmail,
      clientName: invoice.clientName,
      pdfUrl: downloadUrl,
      labelName: invoice.clientName,
    },
    {
      resendApiKey: emailCredentials.resendApiKey ?? '',
      resendFromEmail: emailCredentials.resendFromEmail ?? '',
      fetch: globalThis.fetch,
    },
  )

  const { value: updated } = await portalMemberWrite(
    ctx,
    { route: ROUTE, table: 'artist_invoices', operation: 'update' },
    (db) =>
      updateInvoice(db, invoice.id, ctx.artist.id, {
        status: result.success ? 'sent' : 'draft',
        delivery_status: result.success ? 'sent' : 'failed',
        delivery_attempted_at: new Date().toISOString(),
        delivery_error: result.success ? null : (result.error ?? 'Email delivery failed'),
      }),
  )

  return NextResponse.json({
    invoice: toPortalInvoiceListItem(updated),
    email_sent: result.success,
    email_error: result.success ? null : (result.error ?? 'Email delivery failed'),
  })
})
