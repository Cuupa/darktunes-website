import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { createTourStop, getTourStopsByTourId } from '@/lib/api/tourStops'
import { getTourById } from '@/lib/api/tours'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'
import { parseCSVText } from '@/lib/tour-planner/import'

const schema = z.object({
  tourId: z.string().uuid(),
  csv: z.string().min(1),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticatePortalBearerWithArtist(req, artistId)
  const body = schema.parse(await req.json())
  const tour = await getTourById(supabase, body.tourId)
  if (!tour || tour.artistId !== artist.id) throw new ApiError(404, 'Tour not found')

  const parsed = parseCSVText(body.csv)
  const existing = await getTourStopsByTourId(supabase, body.tourId)
  let order = existing.length

  for (const row of parsed) {
    await createTourStop(supabase, {
      tour_id: body.tourId,
      artist_id: artist.id,
      stop_date: row.date,
      is_travel_day: row.isTravelDay ?? false,
      venue_name: row.venueName || null,
      venue_address: row.venueAddress || null,
      venue_city: row.venueCity || null,
      venue_country: row.venueCountry || null,
      hotel_name: row.hotelName || null,
      hotel_address: row.hotelAddress || null,
      hotel_city: row.hotelCity || null,
      hotel_country: row.hotelCountry || null,
      sort_order: order++,
    })
  }

  const stops = await getTourStopsByTourId(supabase, body.tourId)
  return NextResponse.json({ imported: parsed.length, stops })
})