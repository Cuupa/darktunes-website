/**
 * app/api/admin/invoices/[id]/pdf/route.ts
 *
 * GET — short-lived (10 min) presigned download URL for any invoice PDF.
 * Admin auth via verifyAdmin; the public R2 URL on the row is never returned.
 */

import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { extractBearerToken, verifyAdmin } from '@/lib/adminAuth'
import { getAdminInvoiceById } from '@/lib/api/artistInvoices'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createR2Client } from '@/lib/r2Utils'
import { resolveInvoicePdfObject } from '@/lib/portal/invoicePdfStorage'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const EXPIRY_SECONDS = 600

export const GET = withErrorHandler(async (req: NextRequest) => {
  const token = extractBearerToken(req.headers.get('authorization'))
  await verifyAdmin(token)

  const id = req.nextUrl.pathname.split('/').at(-2)
  if (!id) throw new ApiError(400, 'Missing invoice id')

  const supabase = await createServerSupabaseClient()
  const invoice = await getAdminInvoiceById(supabase, id)
  if (!invoice?.pdfUrl) throw new ApiError(404, 'Invoice PDF not found')

  const { serverEnv } = await import('@/lib/env.server')
  const { key, bucket } = resolveInvoicePdfObject(invoice, {
    publicBucket: serverEnv.CLOUDFLARE_R2_BUCKET_NAME,
    privateBucket: serverEnv.CLOUDFLARE_R2_PRIVATE_INVOICE_BUCKET_NAME,
  })

  const s3 = createR2Client(
    serverEnv.CLOUDFLARE_R2_ACCOUNT_ID,
    serverEnv.CLOUDFLARE_R2_ACCESS_KEY_ID,
    serverEnv.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  )
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: EXPIRY_SECONDS },
  )

  return NextResponse.json({ url })
})
