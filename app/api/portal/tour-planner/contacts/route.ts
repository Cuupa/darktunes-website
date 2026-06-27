import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler } from '@/lib/errors'
import { createTourContact, getTourContactsByArtistId } from '@/lib/api/tourContacts'
import { authenticateTourPlannerRequest } from '@/lib/portal/tourPlannerAuth'

const createSchema = z.object({
  name: z.string().min(1),
  contactType: z.string().default('promoter'),
  company: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
})

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const contacts = await getTourContactsByArtistId(supabase, artist.id)
  return NextResponse.json({ contacts })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const body = createSchema.parse(await req.json())
  const contact = await createTourContact(supabase, {
    artist_id: artist.id,
    name: body.name,
    contact_type: body.contactType,
    company: body.company ?? null,
    email: body.email ?? null,
    phone: body.phone ?? null,
  })
  return NextResponse.json({ contact }, { status: 201 })
})