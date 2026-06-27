import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createTourCrewMember, getTourCrewByTourId } from '@/lib/api/tourCrew'
import { getTourById } from '@/lib/api/tours'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'

const createSchema = z.object({
  tourId: z.string().uuid(),
  name: z.string().min(1),
  role: z.string().default(''),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
})

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const tourId = req.nextUrl.searchParams.get('tourId')
  if (!tourId) throw new ApiError(400, 'tourId required')
  const { supabase, artist } = await authenticatePortalBearerWithArtist(req, artistId)
  const tour = await getTourById(supabase, tourId)
  if (!tour || tour.artistId !== artist.id) throw new ApiError(404, 'Tour not found')
  const crew = await getTourCrewByTourId(supabase, tourId)
  return NextResponse.json({ crew })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticatePortalBearerWithArtist(req, artistId)
  const body = createSchema.parse(await req.json())
  const tour = await getTourById(supabase, body.tourId)
  if (!tour || tour.artistId !== artist.id) throw new ApiError(404, 'Tour not found')
  const member = await createTourCrewMember(supabase, {
    tour_id: body.tourId,
    artist_id: artist.id,
    name: body.name,
    role: body.role,
    email: body.email ?? null,
    phone: body.phone ?? null,
  })
  return NextResponse.json({ member }, { status: 201 })
})