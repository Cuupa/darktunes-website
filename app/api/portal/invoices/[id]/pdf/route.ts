/**
 * app/api/portal/invoices/[id]/pdf/route.ts
 *
 * GET — short-lived (10 min) presigned download URL for an artist's own
 * invoice PDF. Membership via withPortalMembershipWrite; the public R2 URL
 * stored on the row is never returned to the client.
 */

import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { getArtistInvoice } from '@/lib/api/artistInvoices'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { portalMemberWrite, withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'
import { createR2Client } from '@/lib/r2Utils'
import { resolveInvoicePdfObject } from '@/lib/portal/invoicePdfStorage'

const EXPIRY_SECONDS = 600

const ROUTE = 'GET /api/portal/invoices/[id]/pdf'

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artist_id')
  const ctx = await withPortalMembershipWrite(req, artistId)

  const id = req.nextUrl.pathname.split('/').at(-2)
  if (!id) throw new ApiError(400, 'Missing invoice id')

  const { value: invoice } = await portalMemberWrite(
    ctx,
    { route: ROUTE, table: 'artist_invoices', operation: 'select' },
    (db) => getArtistInvoice(db, id, ctx.artist.id),
  )
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
