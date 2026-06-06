import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolvePortalArtist } from '@/lib/api/artistProfiles'
import { createConcert, updateConcert, deleteConcert, setConcertArtists } from '@/lib/api/concerts'

/** Normalize a URL string: prepend https:// if no scheme is present. */
function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function urlField() {
  return z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      const normalized = normalizeUrl(v)
      if (!normalized) return null
      try {
        new URL(normalized)
        return normalized
      } catch {
        return null
      }
    })
}

const createSchema = z.object({
  eventName: z.string().min(1),
  concertDate: z.string().min(1),
  concertTime: z.string().nullable().optional(),
  eventType: z.string().default('gig'),
  venueName: z.string().nullable().optional(),
  venueCity: z.string().nullable().optional(),
  venueCountry: z.string().nullable().optional(),
  venueLat: z.number().nullable().optional(),
  venueLng: z.number().nullable().optional(),
  venueOsmId: z.string().nullable().optional(),
  ticketUrl: urlField(),
  trailerUrl: urlField(),
  newsPostId: z.string().uuid().nullable().optional(),
  featuredArtistIds: z.array(z.string().uuid()).optional(),
  status: z.string().default('announced'),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  eventName: z.string().min(1).optional(),
  concertDate: z.string().min(1).optional(),
  concertTime: z.string().nullable().optional(),
  eventType: z.string().optional(),
  venueName: z.string().nullable().optional(),
  venueCity: z.string().nullable().optional(),
  venueCountry: z.string().nullable().optional(),
  venueLat: z.number().nullable().optional(),
  venueLng: z.number().nullable().optional(),
  venueOsmId: z.string().nullable().optional(),
  ticketUrl: urlField(),
  trailerUrl: urlField(),
  newsPostId: z.string().uuid().nullable().optional(),
  featuredArtistIds: z.array(z.string().uuid()).optional(),
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

  const artistId = request.nextUrl?.searchParams.get('artistId') ?? new URL(request.url).searchParams.get('artistId')
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
    event_time: body.concertTime ?? null,
    event_type: body.eventType,
    venue_name: body.venueName ?? null,
    venue_city: body.venueCity ?? null,
    venue_country: body.venueCountry ?? null,
    venue_lat: body.venueLat ?? null,
    venue_lng: body.venueLng ?? null,
    venue_osm_id: body.venueOsmId ?? null,
    ticket_url: body.ticketUrl ?? null,
    trailer_url: body.trailerUrl ?? null,
    news_post_id: body.newsPostId ?? null,
    status: body.status,
    created_by: user.id,
    source: 'artist',
  })

  if (body.featuredArtistIds?.length) {
    await setConcertArtists(supabase, concert.id, body.featuredArtistIds)
  }

  return NextResponse.json({ ...concert, featuredArtists: [] })
})

export const PATCH = withErrorHandler(async (req: NextRequest) => {
  const { supabase } = await getRequestArtist(req)
  const body = updateSchema.parse(await req.json())

  const concert = await updateConcert(supabase, body.id, {
    event_name: body.eventName,
    concert_date: body.concertDate,
    event_time: body.concertTime,
    event_type: body.eventType,
    venue_name: body.venueName,
    venue_city: body.venueCity,
    venue_country: body.venueCountry,
    venue_lat: body.venueLat,
    venue_lng: body.venueLng,
    venue_osm_id: body.venueOsmId,
    ticket_url: body.ticketUrl,
    trailer_url: body.trailerUrl,
    news_post_id: body.newsPostId,
    status: body.status,
  })

  if (body.featuredArtistIds !== undefined) {
    await setConcertArtists(supabase, body.id, body.featuredArtistIds)
  }

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
