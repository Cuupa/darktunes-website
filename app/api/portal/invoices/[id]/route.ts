import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getArtistInvoice, updateInvoice } from '@/lib/api/artistInvoices'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'

const patchSchema = z.object({
  artist_id: z.string().uuid(),
  status: z.enum(['draft', 'sent', 'paid', 'cancelled']),
})

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const id = req.nextUrl.pathname.split('/').at(-1)
  if (!id) throw new ApiError(400, 'Missing invoice id')

  const body: unknown = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((issue) => issue.message).join('; '))
  }

  const { supabase } = await authenticatePortalBearerWithArtist(req, parsed.data.artist_id)

  const existing = await getArtistInvoice(supabase, id, parsed.data.artist_id)
  if (!existing) throw new ApiError(404, 'Invoice not found')

  if (existing.status === 'sent' && parsed.data.status !== 'paid') {
    throw new ApiError(409, 'Sent invoices are immutable')
  }

  const updated = await updateInvoice(supabase, id, parsed.data.artist_id, {
    status: parsed.data.status,
  })

  return NextResponse.json({ invoice: updated })
})