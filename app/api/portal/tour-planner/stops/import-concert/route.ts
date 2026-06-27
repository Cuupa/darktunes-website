import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { getConcertsByArtistId } from '@/lib/api/concerts'
import { getTourById } from '@/lib/api/tours'
import { getTourStopsByTourId } from '@/lib/api/tourStops'
import { importConcertToTourStop } from '@/lib/api/tourConcertBridge'
import { authenticatePortalBearerWithArtist } from '@/lib/portal/bearerAuth'

const schema = z.object({
  tourId: z.string().uuid(),
  concertId: z.string().uuid(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticatePortalBearerWithArtist(req, artistId)
  const body = schema.parse(await req.json())

  const tour = await getTourById(supabase, body.tourId)
  if (!tour || tour.artistId !== artist.id) throw new ApiError(404, 'Tour not found')

  const concerts = await getConcertsByArtistId(supabase, artist.id)
  const concert = concerts.find((c) => c.id === body.concertId)
  if (!concert) throw new ApiError(404, 'Concert not found')

  const existingStops = await getTourStopsByTourId(supabase, body.tourId)
  const alreadyLinked = existingStops.some((s) => s.concertId === body.concertId)
  if (alreadyLinked) throw new ApiError(409, 'Concert already imported into this tour')

  const stop = await importConcertToTourStop(
    supabase,
    concert,
    body.tourId,
    artist.id,
    existingStops.length,
  )

  return NextResponse.json({ stop }, { status: 201 })
})