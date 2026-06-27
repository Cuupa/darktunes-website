import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createTourStop, getTourStopsByTourId, reorderTourStops } from '@/lib/api/tourStops'
import { getTourById } from '@/lib/api/tours'
import { authenticateTourPlannerRequest } from '@/lib/portal/tourPlannerAuth'
import { showStatusSchema } from '@/lib/tour-planner/validation'

const createSchema = z.object({
  tourId: z.string().uuid(),
  stopDate: z.string().min(1),
  isTravelDay: z.boolean().optional(),
  venueName: z.string().nullable().optional(),
  venueAddress: z.string().nullable().optional(),
  venueCity: z.string().nullable().optional(),
  venueCountry: z.string().nullable().optional(),
  venueLat: z.number().nullable().optional(),
  venueLng: z.number().nullable().optional(),
  showStatus: showStatusSchema.optional(),
  sortOrder: z.number().optional(),
})

const reorderSchema = z.object({
  tourId: z.string().uuid(),
  orderedStopIds: z.array(z.string().uuid()).min(1),
})

export const GET = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const tourId = req.nextUrl.searchParams.get('tourId')
  if (!tourId) throw new ApiError(400, 'tourId is required')

  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const tour = await getTourById(supabase, tourId)
  if (!tour || tour.artistId !== artist.id) throw new ApiError(404, 'Tour not found')

  const stops = await getTourStopsByTourId(supabase, tourId)
  return NextResponse.json({ stops })
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const raw = await req.json()

  if (raw.orderedStopIds) {
    const body = reorderSchema.parse(raw)
    const tour = await getTourById(supabase, body.tourId)
    if (!tour || tour.artistId !== artist.id) throw new ApiError(404, 'Tour not found')
    const existing = await getTourStopsByTourId(supabase, body.tourId)
    const existingIds = new Set(existing.map((stop) => stop.id))
    if (
      body.orderedStopIds.length !== existing.length
      || !body.orderedStopIds.every((id) => existingIds.has(id))
    ) {
      throw new ApiError(400, 'Invalid stop order')
    }
    const stops = await reorderTourStops(supabase, body.tourId, body.orderedStopIds)
    return NextResponse.json({ stops })
  }

  const body = createSchema.parse(raw)
  const tour = await getTourById(supabase, body.tourId)
  if (!tour || tour.artistId !== artist.id) throw new ApiError(404, 'Tour not found')

  const stop = await createTourStop(supabase, {
    tour_id: body.tourId,
    artist_id: artist.id,
    stop_date: body.stopDate,
    is_travel_day: body.isTravelDay ?? false,
    venue_name: body.venueName ?? null,
    venue_address: body.venueAddress ?? null,
    venue_city: body.venueCity ?? null,
    venue_country: body.venueCountry ?? null,
    venue_lat: body.venueLat ?? null,
    venue_lng: body.venueLng ?? null,
    show_status: body.showStatus ?? 'option',
    sort_order: body.sortOrder ?? 0,
  })

  return NextResponse.json({ stop }, { status: 201 })
})