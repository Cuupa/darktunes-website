import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withErrorHandler, ApiError } from '@/lib/errors'
import { getConcertsByArtistId } from '@/lib/api/concerts'
import { getTourStopsByTourId } from '@/lib/api/tourStops'
import { enrichTourStopForViewer } from '@/lib/api/tourStopView'
import { importConcertToTourStop } from '@/lib/api/tourConcertBridge'
import { authenticateTourPlannerRequest, assertTourAccess } from '@/lib/portal/tourPlannerAuth'

const schema = z.object({
  tourId: z.string().uuid(),
  concertId: z.string().uuid(),
})

export const POST = withErrorHandler(async (req: NextRequest) => {
  const artistId = req.nextUrl.searchParams.get('artistId')
  const { supabase, artist } = await authenticateTourPlannerRequest(req, artistId)
  const body = schema.parse(await req.json())

  await assertTourAccess(supabase, body.tourId, artist.id)

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

  const enriched = await enrichTourStopForViewer(supabase, stop, artist.id)
  return NextResponse.json({ stop: enriched }, { status: 201 })
})