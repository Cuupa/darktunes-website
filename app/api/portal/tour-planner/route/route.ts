import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler } from '@/lib/errors'
import { getTourStopsByTourId } from '@/lib/api/tourStops'
import { getTourById, updateTour } from '@/lib/api/tours'
import { authenticateTourPlannerRequest, resolveGoogleMapsApiKey } from '@/lib/portal/tourPlannerAuth'
import { dbStopToTrack } from '@/lib/tour-planner/mappers'
import { calculateTourRoute } from '@/lib/tour-planner/routing'
import type { Json } from '@/types/database'

const schema = z.object({
  tourId: z.string().uuid(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const { tourId } = schema.parse(await req.json())

  const tour = await getTourById(supabase, tourId)
  if (!tour || tour.artistId !== artist.id) {
    return NextResponse.json({ error: 'Tour not found' }, { status: 404 })
  }

  const stops = await getTourStopsByTourId(supabase, tourId)
  const trackStops = stops.map(dbStopToTrack)
  const start = trackStops[0]
  const startLocation = start
    ? { name: start.hotelName || start.venueName, address: start.hotelAddress || start.venueAddress, city: start.hotelCity || start.venueCity, country: start.hotelCountry || start.venueCountry }
    : { name: artist.name, address: '', city: '', country: 'Germany' }

  const route = await calculateTourRoute(
    trackStops,
    startLocation,
    tour.settings.apiProvider,
    resolveGoogleMapsApiKey(tour.settings),
    tour.settings.vehicleType,
    tour.settings.planningMode,
  )

  await updateTour(supabase, tourId, { route_cache: route as unknown as Json })
  return NextResponse.json({ route })
})