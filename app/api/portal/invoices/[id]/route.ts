import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getArtistInvoice, updateInvoice } from '@/lib/api/artistInvoices'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { portalMemberWrite, withPortalMembershipWrite } from '@/lib/portal/withPortalMembership'

const patchSchema = z.object({
  artist_id: z.string().uuid(),
  status: z.enum(['draft', 'sent', 'paid', 'cancelled']),
})

const ROUTE = 'PATCH /api/portal/invoices/[id]'

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const id = req.nextUrl.pathname.split('/').at(-1)
  if (!id) throw new ApiError(400, 'Missing invoice id')

  const body: unknown = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((issue) => issue.message).join('; '))
  }

  const ctx = await withPortalMembershipWrite(req, parsed.data.artist_id)

  const { value: existing } = await portalMemberWrite(
    ctx,
    { route: ROUTE, table: 'artist_invoices', operation: 'select' },
    (db) => getArtistInvoice(db, id, ctx.artist.id),
  )
  if (!existing) throw new ApiError(404, 'Invoice not found')

  if (existing.status === 'sent' && parsed.data.status !== 'paid') {
    throw new ApiError(409, 'Sent invoices are immutable')
  }

  const { value: updated } = await portalMemberWrite(
    ctx,
    { route: ROUTE, table: 'artist_invoices', operation: 'update' },
    (db) =>
      updateInvoice(db, id, ctx.artist.id, {
        status: parsed.data.status,
      }),
  )

  return NextResponse.json({ invoice: updated })
})
