import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { deleteTourContact, updateTourContact } from '@/lib/api/tourContacts'
import { authenticateTourPlannerRequest } from '@/lib/portal/tourPlannerAuth'

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  contactType: z.string().optional(),
  company: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

function contactId(pathname: string): string {
  const id = pathname.split('/').pop()
  if (!id) throw new ApiError(400, 'Missing contact id')
  return id
}

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const id = contactId(req.nextUrl.pathname)
  const body = patchSchema.parse(await req.json())

  const { data, error } = await supabase.from('tour_contacts').select('id').eq('id', id).eq('artist_id', artist.id).maybeSingle()
  if (error || !data) throw new ApiError(404, 'Contact not found')

  const contact = await updateTourContact(supabase, id, {
    name: body.name,
    contact_type: body.contactType,
    company: body.company,
    email: body.email,
    phone: body.phone,
    notes: body.notes,
  })
  return NextResponse.json({ contact })
})

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const id = contactId(req.nextUrl.pathname)

  const { data, error } = await supabase.from('tour_contacts').select('id').eq('id', id).eq('artist_id', artist.id).maybeSingle()
  if (error || !data) throw new ApiError(404, 'Contact not found')

  await deleteTourContact(supabase, id)
  return NextResponse.json({ ok: true })
})