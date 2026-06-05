import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { createConcert, updateConcert, deleteConcert } from '@/lib/api/concerts'

const createSchema = z.object({
  eventName: z.string().min(1),
  concertDate: z.string().min(1),
  venueName: z.string().nullable().optional(),
  venueCity: z.string().nullable().optional(),
  venueCountry: z.string().nullable().optional(),
  ticketUrl: z.string().url().nullable().optional(),
  status: z.string().default('announced'),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  eventName: z.string().min(1).optional(),
  concertDate: z.string().min(1).optional(),
  venueName: z.string().nullable().optional(),
  venueCity: z.string().nullable().optional(),
  venueCountry: z.string().nullable().optional(),
  ticketUrl: z.string().url().nullable().optional(),
  status: z.string().optional(),
})

async function getRequestArtist(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) throw new ApiError(401, 'Missing authorization token')

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)
  if (authError || !user) throw new ApiError(401, 'Invalid or expired token')

  const artistId = req.nextUrl?.searchParams.get('artistId') ?? new URL(req.url).searchParams.get('artistId')
  let artist
  try {
    artist = await resolvePortalArtist(supabase, user.id, artistId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('FORBIDDEN')) throw new ApiError(403, 'No artist linked to this account')
    throw err
  }
  if (!artist) throw new ApiError(403, 'No artist linked to this account')

  return { supabase, artist, user }
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { supabase, artist, user } = await getRequestArtist(req)
  const body = createSchema.parse(await req.json())

  const concert = await createConcert(supabase, {
    artist_id: artist.id,
    artist_name: artist.name,
    event_name: body.eventName,
    concert_date: body.concertDate,
    venue_name: body.venueName ?? null,
    venue_city: body.venueCity ?? null,
    venue_country: body.venueCountry ?? null,
    ticket_url: body.ticketUrl ?? null,
    status: body.status,
    created_by: user.id,
    source: 'artist',
  })

  return NextResponse.json(concert)
})

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const { supabase } = await getRequestArtist(req)
  const body = updateSchema.parse(await req.json())

  const concert = await updateConcert(supabase, body.id, {
    event_name: body.eventName,
    concert_date: body.concertDate,
    venue_name: body.venueName,
    venue_city: body.venueCity,
    venue_country: body.venueCountry,
    ticket_url: body.ticketUrl,
    status: body.status,
  })

  return NextResponse.json(concert)
})

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const { supabase } = await getRequestArtist(req)
  let id = req.nextUrl.searchParams.get('id')
  if (!id) {
    const body = (await req.json().catch(() => null)) as { id?: string } | null
    id = body?.id ?? null
  }

  if (!id) throw new ApiError(400, 'Missing concert id')
  await deleteConcert(supabase, id)
  return NextResponse.json({ success: true })
})
