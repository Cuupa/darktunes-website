/**
 * app/api/portal/invoices/route.ts
 *
 * GET  — list artist invoices (paginated)
 * POST — create invoice, generate PDF, upload to R2, email to client
 */

import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { listArtistInvoices, createArtistInvoice } from '@/lib/api/artistInvoices'
import { generateInvoiceNumber } from '@/lib/portal/invoiceNumber'
import { generateInvoicePdf } from '@/lib/portal/invoicePdf'
import { sendInvoiceEmail } from '@/lib/email/sendInvoiceEmail'
import { createR2Client } from '@/lib/r2Utils'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { z } from 'zod'

const lineItemSchema = z.object({
  description: z.string().min(1).max(500),
  qty: z.number().int().min(1),
  unit_price_cents: z.number().int().min(0),
})

const createInvoiceSchema = z.object({
  artist_id: z.string().uuid(),
  client_name: z.string().min(1).max(500),
  client_email: z.string().email(),
  client_address: z.string().max(1000).optional(),
  line_items: z.array(lineItemSchema).min(1),
  currency: z.string().length(3).default('EUR'),
  tax_rate_pct: z.number().min(0).max(100).default(19),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  issued_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  send_email: z.boolean().default(true),
  send_to_label: z.boolean().default(false),
})

// ── GET /api/portal/invoices ──────────────────────────────────────────────

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) throw new ApiError(401, 'Missing authorization token')

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) throw new ApiError(401, 'Invalid or expired token')

  const artistId = req.nextUrl.searchParams.get('artist_id')
  if (!artistId) throw new ApiError(400, 'artist_id is required')

  await resolvePortalArtist(supabase, user.id, artistId)

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10))
  const { invoices, total } = await listArtistInvoices(supabase, artistId, page)

  return NextResponse.json({ invoices, total, page })
})

// ── POST /api/portal/invoices ─────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) throw new ApiError(401, 'Missing authorization token')

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) throw new ApiError(401, 'Invalid or expired token')

  const body: unknown = await req.json()
  const parsed = createInvoiceSchema.safeParse(body)
  if (!parsed.success) throw new ApiError(400, parsed.error.issues.map((e) => e.message).join('; '))

  const d = parsed.data

  // Verify artist ownership
  let artist
  try {
    artist = await resolvePortalArtist(supabase, user.id, d.artist_id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'Forbidden')
    throw err
  }
  if (!artist) throw new ApiError(403, 'Forbidden')

  const { serverEnv } = await import('@/lib/env.server')

  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber(supabase, d.artist_id)
  const issuedDate = d.issued_date ?? new Date().toISOString().slice(0, 10)

  // Create DB row first (to get ID)
  const invoice = await createArtistInvoice(supabase, {
    artistId: d.artist_id,
    invoiceNumber,
    clientName: d.client_name,
    clientEmail: d.client_email,
    clientAddress: d.client_address,
    lineItems: d.line_items.map((li) => ({
      description: li.description,
      qty: li.qty,
      unit_price_cents: li.unit_price_cents,
    })),
    currency: d.currency,
    taxRatePct: d.tax_rate_pct,
    dueDate: d.due_date,
    issuedDate,
  })

  // Generate PDF
  const pdfBytes = generateInvoicePdf({
    invoiceNumber,
    issuedDate,
    dueDate: d.due_date,
    artistName: artist.name,
    clientName: d.client_name,
    clientEmail: d.client_email,
    clientAddress: d.client_address,
    lineItems: d.line_items.map((li) => ({
      description: li.description,
      qty: li.qty,
      unitPriceCents: li.unit_price_cents,
    })),
    currency: d.currency,
    taxRatePct: d.tax_rate_pct,
  })

  // Upload PDF to R2
  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )
  const key = `invoices/${d.artist_id}/${randomUUID()}.pdf`
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

  // Update DB row with PDF URL + status
  const { updateInvoice } = await import('@/lib/api/artistInvoices')
  const updated = await updateInvoice(supabase, invoice.id, d.artist_id, {
    pdf_url: pdfUrl,
    status: d.send_email ? 'sent' : 'draft',
  })

  // Send email to client
  if (d.send_email) {
    await sendInvoiceEmail(
      {
        artistName: artist.name,
        invoiceNumber,
        clientEmail: d.client_email,
        clientName: d.client_name,
        pdfUrl,
      },
      {
        resendApiKey: serverEnv.RESEND_API_KEY ?? '',
        resendFromEmail: serverEnv.RESEND_FROM_EMAIL ?? '',
        fetch: globalThis.fetch,
      },
    )
  }

  // Optionally send a copy to the label
  if (d.send_to_label) {
    const { getSiteSettings } = await import('@/lib/api/siteSettings')
    const siteSettings = await getSiteSettings(supabase)
    const labelEmail = siteSettings.contactEmail
    if (labelEmail) {
      await sendInvoiceEmail(
        {
          artistName: artist.name,
          invoiceNumber,
          clientEmail: labelEmail,
          clientName: siteSettings.labelName ?? 'Label',
          pdfUrl,
        },
        {
          resendApiKey: serverEnv.RESEND_API_KEY ?? '',
          resendFromEmail: serverEnv.RESEND_FROM_EMAIL ?? '',
          fetch: globalThis.fetch,
        },
      )
    }
  }

  return NextResponse.json({ invoice: updated, pdf_url: pdfUrl }, { status: 201 })
})
