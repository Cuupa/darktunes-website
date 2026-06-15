import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getArtistInvoice, updateInvoice } from '@/lib/api/artistInvoices'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { ApiError, withErrorHandler } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const patchSchema = z.object({
  artist_id: z.string().uuid(),
  status: z.enum(['draft', 'sent', 'paid', 'cancelled']),
})

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) throw new ApiError(401, 'Missing authorization token')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)
  if (authError || !user) throw new ApiError(401, 'Invalid or expired token')

  const id = req.nextUrl.pathname.split('/').at(-1)
  if (!id) throw new ApiError(400, 'Missing invoice id')

  const body: unknown = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((issue) => issue.message).join('; '))
  }

  await resolvePortalArtist(supabase, user.id, parsed.data.artist_id)

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
