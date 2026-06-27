import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { getTourById } from '@/lib/api/tours'
import { authenticateTourPlannerRequest, assertTourAccess, resolveGoogleMapsApiKey } from '@/lib/portal/tourPlannerAuth'
import { geocodeAddress } from '@/lib/tour-planner/geocoding'

const schema = z.object({
  query: z.string().min(1),
  tourId: z.string().uuid().optional(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const body = schema.parse(await req.json())

  let provider: 'nominatim' | 'google' = 'nominatim'
  let apiKey: string | undefined

  if (body.tourId) {
    await assertTourAccess(supabase, body.tourId, artist.id)
    const tour = await getTourById(supabase, body.tourId)
    if (!tour) throw new ApiError(404, 'Tour not found')
    provider = tour.settings.apiProvider
    apiKey = resolveGoogleMapsApiKey(tour.settings)
  }

  const parts = body.query.split(',').map((p) => p.trim())
  const country = parts.pop() ?? ''
  const city = parts.pop() ?? ''
  const address = parts.join(', ')

  const result = await geocodeAddress(address, city, country, provider, apiKey)
  if (result.error || !result.coords) {
    return NextResponse.json({ coords: null, error: result.error ?? 'Address not found' })
  }

  return NextResponse.json({
    coords: { lat: result.coords.lat, lon: result.coords.lon },
    displayName: result.displayName,
  })
})